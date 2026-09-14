import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const isAdmin = auth.roles.includes('ADMIN') || auth.roles.includes('HR_APPROVER')
  const hasPerm = auth.permissions.includes('report.view')
  if (!isAdmin && !hasPerm) {
    throw createError({ statusCode: 403, message: 'Akses ditolak: Anda tidak memiliki wewenang melihat laporan.' })
  }

  const query = getQuery(event)
  const db = useDatabase()

  // 1. Tangani filter periode
  const period = String(query.period || 'month')
  const now = dayjs()

  let fromDate: string
  let toDate: string

  if (period === 'quarter') {
    fromDate = now.startOf('quarter' as any).format('YYYY-MM-DD')
    toDate = now.endOf('quarter' as any).format('YYYY-MM-DD')
  } else if (period === 'year') {
    fromDate = now.startOf('year').format('YYYY-MM-DD')
    toDate = now.endOf('year').format('YYYY-MM-DD')
  } else if (period === 'custom' && query.from && query.to) {
    fromDate = String(query.from).trim()
    toDate = String(query.to).trim()
  } else {
    // Default: bulan ini
    fromDate = now.startOf('month').format('YYYY-MM-DD')
    toDate = now.endOf('month').format('YYYY-MM-DD')
  }

  const departmentId = query.department_id ? String(query.department_id).trim() : null
  const leaveTypeId = query.leave_type_id ? String(query.leave_type_id).trim() : null

  // 2. Metrik Utama Ringkasan
  const summaryRows = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE r.status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE r.status = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE r.status IN ('SUBMITTED', 'IN_REVIEW'))::int AS in_review,
      COUNT(*) FILTER (WHERE r.is_auto_decided = true)::int AS auto_decided,
      COUNT(*) FILTER (WHERE r.status IN ('APPROVED', 'REJECTED', 'EXPIRED'))::int AS total_decided,
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (r.decided_at - r.submitted_at)) / 3600.0
        ) FILTER (WHERE r.decided_at IS NOT NULL AND r.submitted_at IS NOT NULL),
        1
      ) AS avg_hours
    FROM approvals.leave_requests r
    JOIN org.employees e ON e.id = r.employee_id
    WHERE r.created_at::date >= ${fromDate}::date
      AND r.created_at::date <= ${toDate}::date
      AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
      AND (${leaveTypeId}::text IS NULL OR r.leave_type_id = ${leaveTypeId}::uuid)
  `)) as any[]

  const s = summaryRows[0] || {}
  const totalDecided = s.total_decided || 0
  const autoDecidedPct = totalDecided > 0 ? Math.round(((s.auto_decided || 0) / totalDecided) * 100) : 0

  // 3. Rekap 1: Per Jenis Izin
  const byLeaveType = (await db.execute(sql`
    SELECT
      lt.id AS "leaveTypeId",
      lt.code,
      lt.name,
      lt.color,
      lt.icon,
      COUNT(r.id)::int AS "requestCount",
      COALESCE(SUM(r.total_days), 0)::numeric AS "totalDays",
      COUNT(r.id) FILTER (WHERE r.status = 'APPROVED')::int AS "approvedCount"
    FROM leaves.leave_types lt
    LEFT JOIN approvals.leave_requests r ON r.leave_type_id = lt.id
      AND r.created_at::date >= ${fromDate}::date
      AND r.created_at::date <= ${toDate}::date
    LEFT JOIN org.employees e ON e.id = r.employee_id
      AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
    GROUP BY lt.id, lt.code, lt.name, lt.color, lt.icon
    ORDER BY "totalDays" DESC, "requestCount" DESC
  `)) as any[]

  // 4. Rekap 2: Per Departemen
  const byDepartment = (await db.execute(sql`
    SELECT
      d.id AS "departmentId",
      d.name AS "departmentName",
      COUNT(DISTINCT e.id)::int AS "employeeCount",
      COUNT(r.id)::int AS "requestCount",
      COALESCE(SUM(r.total_days), 0)::numeric AS "totalDays",
      ROUND(
        COALESCE(SUM(r.total_days), 0)::numeric / GREATEST(COUNT(DISTINCT e.id), 1),
        1
      ) AS "avgDaysPerEmployee"
    FROM org.departments d
    LEFT JOIN org.employees e ON e.department_id = d.id AND e.is_active = true
    LEFT JOIN approvals.leave_requests r ON r.employee_id = e.id
      AND r.created_at::date >= ${fromDate}::date
      AND r.created_at::date <= ${toDate}::date
      AND (${leaveTypeId}::text IS NULL OR r.leave_type_id = ${leaveTypeId}::uuid)
    WHERE (${departmentId}::text IS NULL OR d.id = ${departmentId}::uuid)
    GROUP BY d.id, d.name
    ORDER BY "totalDays" DESC, "requestCount" DESC
  `)) as any[]

  // 5. Rekap 3: Sisa Kuota Cuti Pegawai & Risiko Akhir Tahun
  const currentMonth = now.month() + 1 // 1-12
  const currentYear = now.year()
  const quotaBalances = (await db.execute(sql`
    SELECT
      e.id AS "employeeId",
      e.nip,
      e.full_name AS "fullName",
      d.name AS "departmentName",
      q.allocated::numeric AS allocated,
      q.used::numeric AS used,
      q.reserved::numeric AS reserved,
      q.balance::numeric AS balance,
      (q.balance >= 8 AND ${currentMonth} >= 10) AS "isYearEndRisk"
    FROM leaves.leave_quotas q
    JOIN org.employees e ON e.id = q.employee_id
    LEFT JOIN org.departments d ON d.id = e.department_id
    WHERE q.period_year = ${currentYear}::smallint
      AND e.is_active = true
      AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
    ORDER BY q.balance DESC, e.full_name ASC
    LIMIT 100
  `)) as any[]

  // 6. Rekap 4: Kinerja Approval per Approver
  const approverPerformance = (await db.execute(sql`
    SELECT
      e.id AS "approverId",
      e.full_name AS "approverName",
      d.name AS "departmentName",
      COUNT(a.id)::int AS "totalTasks",
      COUNT(a.id) FILTER (WHERE a.response = 'APPROVED')::int AS "approvedCount",
      COUNT(a.id) FILTER (WHERE a.response = 'REJECTED')::int AS "rejectedCount",
      COUNT(a.id) FILTER (WHERE t.status = 'ESCALATED' OR a.responded_at > t.due_at)::int AS "overdueCount",
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (a.responded_at - t.started_at)) / 3600.0
        ) FILTER (WHERE a.responded_at IS NOT NULL AND t.started_at IS NOT NULL),
        1
      ) AS "avgResponseHours"
    FROM approvals.approval_task_assignees a
    JOIN approvals.approval_tasks t ON t.id = a.task_id
    JOIN org.employees e ON e.id = a.employee_id
    LEFT JOIN org.departments d ON d.id = e.department_id
    WHERE t.created_at::date >= ${fromDate}::date
      AND t.created_at::date <= ${toDate}::date
      AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
    GROUP BY e.id, e.full_name, d.name
    ORDER BY "totalTasks" DESC, "avgResponseHours" ASC
  `)) as any[]

  // 7. Rekap 5: Pengajuan Diputuskan Otomatis (Audit Sistem)
  const autoDecidedList = (await db.execute(sql`
    SELECT
      r.id AS "requestId",
      r.request_number AS "requestNumber",
      e.full_name AS "employeeName",
      d.name AS "departmentName",
      lt.name AS "leaveTypeName",
      r.status,
      r.decision_reason AS "decisionReason",
      r.total_days::numeric AS "totalDays",
      r.decided_at AS "decidedAt"
    FROM approvals.leave_requests r
    JOIN org.employees e ON e.id = r.employee_id
    JOIN leaves.leave_types lt ON lt.id = r.leave_type_id
    LEFT JOIN org.departments d ON d.id = e.department_id
    WHERE r.is_auto_decided = true
      AND r.created_at::date >= ${fromDate}::date
      AND r.created_at::date <= ${toDate}::date
      AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
      AND (${leaveTypeId}::text IS NULL OR r.leave_type_id = ${leaveTypeId}::uuid)
    ORDER BY r.decided_at DESC
    LIMIT 50
  `)) as any[]

  return {
    data: {
      period: {
        type: period,
        from: fromDate,
        to: toDate,
      },
      summary: {
        total: s.total || 0,
        approved: s.approved || 0,
        rejected: s.rejected || 0,
        inReview: s.in_review || 0,
        autoDecided: s.auto_decided || 0,
        autoDecidedPct,
        avgDecisionHours: s.avg_hours !== null ? Number(s.avg_hours) : 0,
      },
      byLeaveType,
      byDepartment,
      quotaBalances,
      approverPerformance,
      autoDecidedList,
    },
  }
})
