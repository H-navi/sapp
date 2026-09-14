import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return ''
  const str = String(val).replace(/[\r\n]+/g, ' ').trim()
  if (str.includes(';') || str.includes('"') || str.includes(',')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const isAdmin = auth.roles.includes('ADMIN') || auth.roles.includes('HR_APPROVER')
  const hasPerm = auth.permissions.includes('report.view')
  if (!isAdmin && !hasPerm) {
    throw createError({ statusCode: 403, message: 'Akses ditolak: Anda tidak memiliki wewenang mengekspor laporan.' })
  }
  const query = getQuery(event)
  const db = useDatabase()

  const type = String(query.type || 'requests')
  const fromDate = String(query.from || dayjs().startOf('month').format('YYYY-MM-DD')).trim()
  const toDate = String(query.to || dayjs().endOf('month').format('YYYY-MM-DD')).trim()
  const departmentId = query.department_id ? String(query.department_id).trim() : null

  let csvContent = '\uFEFF' // UTF-8 BOM
  const filename = `rekap-perizinan-${fromDate}-sd-${toDate}.csv`

  if (type === 'quota') {
    const currentYear = dayjs().year()
    const currentMonth = dayjs().month() + 1

    const rows = (await db.execute(sql`
      SELECT
        e.nip,
        e.full_name,
        d.name AS department_name,
        q.allocated::numeric AS allocated,
        q.used::numeric AS used,
        q.reserved::numeric AS reserved,
        q.balance::numeric AS balance,
        CASE WHEN (q.balance >= 8 AND ${currentMonth} >= 10) THEN 'RISIKO PENUMPUKAN' ELSE 'AMAN' END AS risk_status
      FROM leaves.leave_quotas q
      JOIN org.employees e ON e.id = q.employee_id
      LEFT JOIN org.departments d ON d.id = e.department_id
      WHERE q.period_year = ${currentYear}::smallint
        AND e.is_active = true
        AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
      ORDER BY q.balance DESC, e.full_name ASC
    `)) as any[]

    const headers = ['NIP', 'Nama Pegawai', 'Departemen', 'Alokasi Kuota', 'Cuti Terpakai', 'Cuti Dipesan', 'Sisa Kuota', 'Status Akhir Tahun']
    csvContent += headers.map(escapeCsvCell).join(';') + '\r\n'

    for (const r of rows) {
      csvContent += [
        r.nip,
        r.full_name,
        r.department_name || '-',
        r.allocated,
        r.used,
        r.reserved,
        r.balance,
        r.risk_status,
      ].map(escapeCsvCell).join(';') + '\r\n'
    }
  } else if (type === 'performance') {
    const rows = (await db.execute(sql`
      SELECT
        e.nip,
        e.full_name,
        d.name AS department_name,
        COUNT(a.id)::int AS total_tasks,
        COUNT(a.id) FILTER (WHERE a.response = 'APPROVED')::int AS approved_count,
        COUNT(a.id) FILTER (WHERE a.response = 'REJECTED')::int AS rejected_count,
        COUNT(a.id) FILTER (WHERE t.status = 'ESCALATED' OR a.responded_at > t.due_at)::int AS overdue_count,
        ROUND(
          AVG(
            EXTRACT(EPOCH FROM (a.responded_at - t.started_at)) / 3600.0
          ) FILTER (WHERE a.responded_at IS NOT NULL AND t.started_at IS NOT NULL),
          1
        ) AS avg_hours
      FROM approvals.approval_task_assignees a
      JOIN approvals.approval_tasks t ON t.id = a.task_id
      JOIN org.employees e ON e.id = a.employee_id
      LEFT JOIN org.departments d ON d.id = e.department_id
      WHERE t.created_at::date >= ${fromDate}::date
        AND t.created_at::date <= ${toDate}::date
        AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
      GROUP BY e.nip, e.full_name, d.name
      ORDER BY total_tasks DESC
    `)) as any[]

    const headers = ['NIP', 'Nama Approver', 'Departemen', 'Total Tugas', 'Disetujui', 'Ditolak', 'Lewat Batas SLA', 'Rata-rata Waktu Respons (Jam)']
    csvContent += headers.map(escapeCsvCell).join(';') + '\r\n'

    for (const r of rows) {
      csvContent += [
        r.nip,
        r.full_name,
        r.department_name || '-',
        r.total_tasks,
        r.approved_count,
        r.rejected_count,
        r.overdue_count,
        r.avg_hours !== null ? r.avg_hours : '-',
      ].map(escapeCsvCell).join(';') + '\r\n'
    }
  } else {
    // Default: 'requests'
    const rows = (await db.execute(sql`
      SELECT
        r.request_number,
        e.nip,
        e.full_name,
        d.name AS department_name,
        lt.name AS leave_type_name,
        r.start_date::text AS start_date,
        r.end_date::text AS end_date,
        r.total_days::numeric AS total_days,
        r.working_days::numeric AS working_days,
        r.status,
        r.reason,
        COALESCE(dec_e.full_name, CASE WHEN r.is_auto_decided THEN 'SISTEM (Otomatis)' ELSE '-' END) AS decided_by,
        r.decision_reason,
        r.created_at::text AS created_at
      FROM approvals.leave_requests r
      JOIN org.employees e ON e.id = r.employee_id
      JOIN leaves.leave_types lt ON lt.id = r.leave_type_id
      LEFT JOIN org.departments d ON d.id = e.department_id
      LEFT JOIN org.employees dec_e ON dec_e.id = r.decided_by
      WHERE r.created_at::date >= ${fromDate}::date
        AND r.created_at::date <= ${toDate}::date
        AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
      ORDER BY r.created_at DESC
    `)) as any[]

    const headers = [
      'Nomor Pengajuan',
      'NIP',
      'Nama Pemohon',
      'Departemen',
      'Jenis Izin',
      'Tanggal Mulai',
      'Tanggal Selesai',
      'Total Hari',
      'Hari Kerja',
      'Status',
      'Alasan Pengajuan',
      'Diputuskan Oleh',
      'Keterangan Keputusan',
      'Waktu Pengajuan',
    ]

    csvContent += headers.map(escapeCsvCell).join(';') + '\r\n'

    for (const r of rows) {
      csvContent += [
        r.request_number,
        r.nip,
        r.full_name,
        r.department_name || '-',
        r.leave_type_name,
        r.start_date,
        r.end_date,
        r.total_days,
        r.working_days,
        r.status,
        r.reason,
        r.decided_by,
        r.decision_reason || '-',
        dayjs(r.created_at).format('YYYY-MM-DD HH:mm'),
      ].map(escapeCsvCell).join(';') + '\r\n'
    }
  }

  setHeaders(event, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  })

  return csvContent
})
