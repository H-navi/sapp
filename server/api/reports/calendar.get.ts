import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const db = useDatabase()

  // Parsing bulan: format YYYY-MM
  const monthParam = query.month ? String(query.month).trim() : dayjs().format('YYYY-MM')
  const baseDate = dayjs(monthParam, 'YYYY-MM', true).isValid() ? dayjs(monthParam, 'YYYY-MM') : dayjs()

  const fromDate = baseDate.startOf('month').format('YYYY-MM-DD')
  const toDate = baseDate.endOf('month').format('YYYY-MM-DD')

  // Otorisasi & Filter Departemen:
  // Jika user tidak punya hak 'report.view' atau 'request.view.all', batasi ke departemennya
  const canViewAll = auth.permissions.includes('report.view') || auth.permissions.includes('request.view.all') || auth.roles.includes('ADMIN')
  let departmentId: string | null = null

  if (canViewAll) {
    departmentId = query.department_id ? String(query.department_id).trim() : null
  } else {
    departmentId = auth.departmentId || null
  }

  // 1. Ambil Hari Libur Nasional & Cuti Bersama
  const holidays = (await db.execute(sql`
    SELECT
      holiday_date::text AS "date",
      name,
      type,
      deducts_quota AS "deductsQuota"
    FROM system.holidays
    WHERE holiday_date >= ${fromDate}::date
      AND holiday_date <= ${toDate}::date
    ORDER BY holiday_date ASC
  `)) as any[]

  // 2. Ambil Hari Izin Pegawai (status SUBMITTED, IN_REVIEW, APPROVED)
  const leaves = (await db.execute(sql`
    SELECT
      rd.id,
      rd.leave_date::text AS "date",
      rd.day_part AS "dayPart",
      rd.day_value::numeric AS "dayValue",
      rd.is_working_day AS "isWorkingDay",
      rd.is_holiday AS "isHoliday",
      r.id AS "requestId",
      r.request_number AS "requestNumber",
      r.status AS "status",
      e.id AS "employeeId",
      e.full_name AS "fullName",
      e.nip,
      d.id AS "departmentId",
      d.name AS "departmentName",
      lt.id AS "leaveTypeId",
      lt.name AS "leaveTypeName",
      lt.color AS "leaveTypeColor",
      lt.code AS "leaveTypeCode"
    FROM approvals.leave_request_days rd
    JOIN approvals.leave_requests r ON r.id = rd.request_id
    JOIN org.employees e ON e.id = r.employee_id
    LEFT JOIN org.departments d ON d.id = e.department_id
    JOIN leaves.leave_types lt ON lt.id = r.leave_type_id
    WHERE rd.leave_date >= ${fromDate}::date
      AND rd.leave_date <= ${toDate}::date
      AND r.status IN ('SUBMITTED', 'IN_REVIEW', 'APPROVED')
      AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
    ORDER BY rd.leave_date ASC, e.full_name ASC
  `)) as any[]

  // 3. Ambil daftar departemen untuk dropdown filter jika user berwenang
  let departments: any[] = []
  if (canViewAll) {
    departments = (await db.execute(sql`
      SELECT id, name, code
      FROM org.departments
      WHERE is_active = true
      ORDER BY name ASC
    `)) as any[]
  }

  return {
    data: {
      month: baseDate.format('YYYY-MM'),
      monthName: baseDate.format('MMMM YYYY'),
      fromDate,
      toDate,
      activeDepartmentId: departmentId,
      holidays,
      leaves,
      departments,
    },
  }
})
