import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const isAdmin = auth.roles.includes('ADMIN') || auth.roles.includes('HR_APPROVER')
  const hasPerm = auth.permissions.includes('request.view.all')
  if (!isAdmin && !hasPerm) {
    throw createError({ statusCode: 403, message: 'Akses ditolak.' })
  }

  const query = getQuery(event)
  const db = useDatabase()

  const page = Math.max(1, Number(query.page || 1))
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)))
  const offset = (page - 1) * limit

  const status = query.status && String(query.status).trim() !== '' ? String(query.status).trim() : null
  const leaveTypeId = query.leave_type_id && String(query.leave_type_id).trim() !== '' ? String(query.leave_type_id).trim() : null
  const departmentId = query.department_id && String(query.department_id).trim() !== '' ? String(query.department_id).trim() : null
  const search = query.search && String(query.search).trim() !== '' ? `%${String(query.search).trim()}%` : null
  const startDate = query.start_date && String(query.start_date).trim() !== '' ? String(query.start_date).trim() : null
  const endDate = query.end_date && String(query.end_date).trim() !== '' ? String(query.end_date).trim() : null

  // Status metrics summary
  const summaryRows = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'IN_REVIEW'))::int AS in_review,
      COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
    FROM approvals.leave_requests
  `)) as any[]

  const summary = summaryRows[0] || {
    total: 0,
    in_review: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
  }

  // Count total matching
  const countRows = (await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM approvals.leave_requests r
    JOIN org.employees e ON e.id = r.employee_id
    JOIN leaves.leave_types lt ON lt.id = r.leave_type_id
    LEFT JOIN org.departments d ON d.id = e.department_id
    WHERE (${status}::text IS NULL OR (${status} = 'IN_REVIEW' AND r.status::text IN ('SUBMITTED', 'IN_REVIEW')) OR r.status::text = ${status})
      AND (${leaveTypeId}::text IS NULL OR r.leave_type_id = ${leaveTypeId}::uuid)
      AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
      AND (${startDate}::text IS NULL OR r.start_date >= ${startDate}::date)
      AND (${endDate}::text IS NULL OR r.end_date <= ${endDate}::date)
      AND (${search}::text IS NULL OR r.request_number ILIKE ${search} OR e.full_name ILIKE ${search} OR e.nip ILIKE ${search})
  `)) as any[]

  const total = countRows[0]?.total || 0

  // Rows matching
  const rows = (await db.execute(sql`
    SELECT
      r.id,
      r.request_number AS "requestNumber",
      r.start_date::text AS "startDate",
      r.end_date::text AS "endDate",
      r.total_days::numeric AS "totalDays",
      r.working_days::numeric AS "workingDays",
      r.reason,
      r.status,
      r.current_step_order AS "currentStepOrder",
      r.submitted_at AS "submittedAt",
      r.final_deadline_at AS "finalDeadlineAt",
      r.decided_at AS "decidedAt",
      r.decision_source AS "decisionSource",
      r.decision_reason AS "decisionReason",
      r.created_at AS "createdAt",
      e.id AS "employeeId",
      e.nip AS "employeeNip",
      e.full_name AS "employeeName",
      d.name AS "departmentName",
      lt.id AS "leaveTypeId",
      lt.code AS "leaveTypeCode",
      lt.name AS "leaveTypeName",
      lt.color AS "leaveTypeColor",
      lt.icon AS "leaveTypeIcon"
    FROM approvals.leave_requests r
    JOIN org.employees e ON e.id = r.employee_id
    JOIN leaves.leave_types lt ON lt.id = r.leave_type_id
    LEFT JOIN org.departments d ON d.id = e.department_id
    WHERE (${status}::text IS NULL OR (${status} = 'IN_REVIEW' AND r.status::text IN ('SUBMITTED', 'IN_REVIEW')) OR r.status::text = ${status})
      AND (${leaveTypeId}::text IS NULL OR r.leave_type_id = ${leaveTypeId}::uuid)
      AND (${departmentId}::text IS NULL OR e.department_id = ${departmentId}::uuid)
      AND (${startDate}::text IS NULL OR r.start_date >= ${startDate}::date)
      AND (${endDate}::text IS NULL OR r.end_date <= ${endDate}::date)
      AND (${search}::text IS NULL OR r.request_number ILIKE ${search} OR e.full_name ILIKE ${search} OR e.nip ILIKE ${search})
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as any[]

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary,
  }
})
