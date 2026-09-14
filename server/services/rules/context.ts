import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { EvaluateInput, RuleContext } from './types'
import { expandLeaveDays, APP_TZ } from '../../utils/calendar'

dayjs.extend(utc)
dayjs.extend(timezone)

export async function buildRuleContext(input: EvaluateInput): Promise<RuleContext> {
  const tx = input.tx
  const today = dayjs().tz(APP_TZ).format('YYYY-MM-DD')
  const excludeId = input.excludeRequestId ?? null

  // 1. Ambil data pegawai beserta perhitungan masa kerja dalam bulan (via SQL age)
  const empRows = (await tx.execute(sql`
    SELECT e.id,
           e.full_name,
           e.gender,
           e.employment_status,
           e.join_date::text AS join_date,
           e.department_id,
           (EXTRACT(YEAR FROM age(CURRENT_DATE, e.join_date)) * 12 +
            EXTRACT(MONTH FROM age(CURRENT_DATE, e.join_date)))::int AS employment_months
    FROM employees e
    WHERE e.id = ${input.employeeId}::uuid
    LIMIT 1
  `)) as any[]

  if (empRows.length === 0) {
    throw new Error(`Pegawai dengan ID '${input.employeeId}' tidak ditemukan`)
  }
  const emp = empRows[0]

  // 2. Ambil data jenis izin
  const ltRows = (await tx.execute(sql`
    SELECT id, code, name, counts_working_days_only, deducts_quota
    FROM leave_types
    WHERE id = ${input.leaveTypeId}::uuid
    LIMIT 1
  `)) as any[]

  if (ltRows.length === 0) {
    throw new Error(`Jenis izin dengan ID '${input.leaveTypeId}' tidak ditemukan`)
  }
  const lt = ltRows[0]

  // 3. Uraikan rentang tanggal menjadi hari-hari
  const days = await expandLeaveDays(tx, input.startDate, input.endDate)
  const dateStrings = days.map((d) => d.date)

  // 4. Batch query paralel untuk pemakaian dan konteks lainnya
  const [
    usageRows,
    requestsThisMonthRows,
    approvedDateRows,
    prevRequestRows,
    overlappingRows,
    teamRows,
    quotaRows,
    holidayRows,
  ] = await Promise.all([
    // A. Pemakaian per minggu (ISO) dan per bulan untuk jenis izin yang sama tahun ini
    tx.execute(sql`
      SELECT to_char(d.leave_date, 'IYYY-"W"IW') AS minggu,
             to_char(d.leave_date, 'YYYY-MM')    AS bulan,
             COALESCE(sum(d.day_value), 0)::numeric AS jumlah_hari
      FROM leave_request_days d
      JOIN leave_requests r ON r.id = d.request_id
      WHERE r.employee_id = ${input.employeeId}::uuid
        AND r.leave_type_id = ${input.leaveTypeId}::uuid
        AND r.status IN ('SUBMITTED','IN_REVIEW','APPROVED')
        AND (${excludeId}::uuid IS NULL OR r.id <> ${excludeId}::uuid)
        AND d.leave_date >= date_trunc('year', CURRENT_DATE)
      GROUP BY 1, 2
    `) as Promise<any[]>,

    // B. Jumlah pengajuan bulan ini untuk jenis izin yang sama
    tx.execute(sql`
      SELECT count(DISTINCT r.id)::int AS count
      FROM leave_requests r
      WHERE r.employee_id = ${input.employeeId}::uuid
        AND r.leave_type_id = ${input.leaveTypeId}::uuid
        AND r.status IN ('SUBMITTED','IN_REVIEW','APPROVED')
        AND (${excludeId}::uuid IS NULL OR r.id <> ${excludeId}::uuid)
        AND r.start_date >= date_trunc('month', CURRENT_DATE)
        AND r.start_date < date_trunc('month', CURRENT_DATE) + interval '1 month'
    `) as Promise<any[]>,

    // C. Daftar tanggal yang sudah disetujui / aktif untuk jenis izin yang sama (rentang 6 bulan)
    tx.execute(sql`
      SELECT DISTINCT d.leave_date::text AS tanggal
      FROM leave_request_days d
      JOIN leave_requests r ON r.id = d.request_id
      WHERE r.employee_id = ${input.employeeId}::uuid
        AND r.leave_type_id = ${input.leaveTypeId}::uuid
        AND r.status IN ('SUBMITTED','IN_REVIEW','APPROVED')
        AND (${excludeId}::uuid IS NULL OR r.id <> ${excludeId}::uuid)
        AND d.is_working_day = true
        AND d.leave_date >= (CURRENT_DATE - interval '6 months')::date
        AND d.leave_date <= (CURRENT_DATE + interval '6 months')::date
      ORDER BY 1
    `) as Promise<any[]>,

    // D. Apakah pernah mengajukan izin jenis ini sebelumnya (untuk ONCE_PER_EMPLOYMENT)
    tx.execute(sql`
      SELECT r.request_number
      FROM leave_requests r
      WHERE r.employee_id = ${input.employeeId}::uuid
        AND r.leave_type_id = ${input.leaveTypeId}::uuid
        AND r.status IN ('SUBMITTED','IN_REVIEW','APPROVED')
        AND (${excludeId}::uuid IS NULL OR r.id <> ${excludeId}::uuid)
      ORDER BY r.created_at DESC
      LIMIT 1
    `) as Promise<any[]>,

    // E. Cek bentrok pengajuan yang bertumpuk pada rentang tanggal yang sama
    tx.execute(sql`
      SELECT r.request_number
      FROM leave_requests r
      WHERE r.employee_id = ${input.employeeId}::uuid
        AND r.status IN ('SUBMITTED','IN_REVIEW','APPROVED')
        AND (${excludeId}::uuid IS NULL OR r.id <> ${excludeId}::uuid)
        AND r.start_date <= ${input.endDate}::date
        AND r.end_date >= ${input.startDate}::date
      LIMIT 1
    `) as Promise<any[]>,

    // F. Jumlah rekan sedepartemen yang izin di tanggal yang sama
    emp.department_id && dateStrings.length > 0
      ? (tx.execute(sql`
          SELECT d.leave_date::text AS tanggal, count(DISTINCT r.employee_id)::int AS jumlah
          FROM leave_request_days d
          JOIN leave_requests r ON r.id = d.request_id
          JOIN employees e      ON e.id = r.employee_id
          WHERE e.department_id = ${emp.department_id}::uuid
            AND r.employee_id <> ${input.employeeId}::uuid
            AND r.status IN ('SUBMITTED','IN_REVIEW','APPROVED')
            AND d.leave_date = ANY(ARRAY[${sql.join(dateStrings.map((d) => sql`${d}::date`), sql`, `)}])
          GROUP BY d.leave_date
        `) as Promise<any[]>)
      : Promise.resolve([]),

    // G. Sisa kuota jika jenis izin memotong kuota
    lt.deducts_quota
      ? (tx.execute(sql`
          SELECT balance::numeric, allocated::numeric, used::numeric, reserved::numeric
          FROM leave_quotas
          WHERE employee_id = ${input.employeeId}::uuid
            AND year = EXTRACT(YEAR FROM CURRENT_DATE)::smallint
          LIMIT 1
        `) as Promise<any[]>)
      : Promise.resolve([]),

    // H. Hari libur
    tx.execute(sql`
      SELECT holiday_date::text AS tgl
      FROM holidays
      WHERE holiday_date >= (date_trunc('year', CURRENT_DATE) - interval '6 months')::date
        AND holiday_date <= (date_trunc('year', CURRENT_DATE) + interval '18 months')::date
    `) as Promise<any[]>,
  ])

  // Bangun peta hari per minggu dan per bulan
  const daysByWeek: Record<string, number> = {}
  const daysByMonth: Record<string, number> = {}
  let daysThisYear = 0

  for (const row of usageRows) {
    const qty = Number(row.jumlah_hari)
    if (row.minggu) {
      daysByWeek[row.minggu] = (daysByWeek[row.minggu] ?? 0) + qty
    }
    if (row.bulan) {
      daysByMonth[row.bulan] = (daysByMonth[row.bulan] ?? 0) + qty
    }
    daysThisYear += qty
  }

  const requestsThisMonth = requestsThisMonthRows.length > 0 ? Number(requestsThisMonthRows[0].count) : 0
  const approvedDates = approvedDateRows.map((r) => String(r.tanggal).substring(0, 10))

  const hasPreviousRequestEver = prevRequestRows.length > 0
  const previousRequestNumber = hasPreviousRequestEver ? prevRequestRows[0].request_number : null

  const overlappingRequestNumber = overlappingRows.length > 0 ? overlappingRows[0].request_number : null

  const teamOnLeaveByDate: Record<string, number> = {}
  for (const row of teamRows) {
    const tgl = String(row.tanggal).substring(0, 10)
    teamOnLeaveByDate[tgl] = Number(row.jumlah)
  }

  let quota: RuleContext['quota'] = null
  if (lt.deducts_quota && quotaRows.length > 0) {
    quota = {
      balance: Number(quotaRows[0].balance),
      allocated: Number(quotaRows[0].allocated),
      used: Number(quotaRows[0].used),
      reserved: Number(quotaRows[0].reserved),
    }
  }

  const holidays = holidayRows.map((r) => String(r.tgl).substring(0, 10))

  return {
    request: {
      id: input.excludeRequestId,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      totalDays: input.totalDays,
      workingDays: input.workingDays,
      attachmentCount: input.attachmentCount,
      days: days.map((d) => ({
        date: d.date,
        isWorkingDay: d.isWorkingDay,
        dayValue: d.dayValue,
      })),
    },
    employee: {
      id: emp.id,
      name: emp.full_name,
      gender: emp.gender,
      employmentStatus: emp.employment_status,
      joinDate: emp.join_date,
      departmentId: emp.department_id,
      employmentMonths: Number(emp.employment_months ?? 0),
    },
    leaveType: {
      code: lt.code,
      name: lt.name,
      countsWorkingDaysOnly: Boolean(lt.counts_working_days_only),
    },
    usage: {
      daysByWeek,
      daysByMonth,
      daysThisYear,
      requestsThisMonth,
      approvedDates,
      hasPreviousRequestEver,
      previousRequestNumber,
      overlappingRequestNumber,
      teamOnLeaveByDate,
    },
    quota,
    today,
    holidays,
  }
}
