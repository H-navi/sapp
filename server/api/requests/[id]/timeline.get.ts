import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import { loadWorkingCalendar, workingHoursBetween } from '~~/server/utils/working-time'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const requestId = getRouterParam(event, 'id')

  if (!requestId) {
    throw createError({ statusCode: 400, message: 'ID pengajuan wajib disertakan.' })
  }

  const db = useDatabase()

  // 1. Ambil info dasar pengajuan untuk otorisasi
  const reqRows = (await db.execute(sql`
    SELECT r.id,
           r.employee_id,
           r.request_number,
           r.status,
           r.created_at,
           e.department_id,
           e.manager_id
    FROM approvals.leave_requests r
    JOIN org.employees e ON e.id = r.employee_id
    WHERE r.id = ${requestId}::uuid
    LIMIT 1
  `)) as any[]

  if (reqRows.length === 0) {
    throw createError({ statusCode: 404, message: 'Pengajuan tidak ditemukan.' })
  }

  const req = reqRows[0]

  // 2. Pemeriksaan Hak Akses (Otorisasi)
  const isOwner = auth.employeeId && auth.employeeId === req.employee_id
  const canViewAll = auth.permissions.includes('request.view.all')
  const isAdmin = auth.roles.includes('ADMIN') || auth.roles.includes('HR_APPROVER')

  let isManager = false
  if (auth.permissions.includes('request.view.team') && auth.employeeId) {
    if (req.manager_id === auth.employeeId || req.department_id === auth.departmentId) {
      isManager = true
    }
  }

  let isAssignedApprover = false
  if (auth.employeeId) {
    const approverRows = (await db.execute(sql`
      SELECT a.id
      FROM approvals.approval_task_assignees a
      JOIN approvals.approval_tasks t ON t.id = a.task_id
      WHERE t.request_id = ${requestId}::uuid
        AND a.employee_id = ${auth.employeeId}::uuid
      LIMIT 1
    `)) as any[]
    isAssignedApprover = approverRows.length > 0
  }

  if (!isOwner && !canViewAll && !isAdmin && !isManager && !isAssignedApprover) {
    throw createError({
      statusCode: 403,
      message: 'Anda tidak memiliki hak akses untuk melihat lini masa pengajuan ini.',
    })
  }

  // 3. Ambil data lini masa dari View v_request_timeline
  const timelineRows = (await db.execute(sql`
    SELECT id,
           request_id AS "requestId",
           request_number AS "requestNumber",
           created_at AS "createdAt",
           step_order AS "stepOrder",
           step_name AS "stepName",
           action,
           actor_type AS "actorType",
           actor_employee_id AS "actorEmployeeId",
           actor_name AS "actorName",
           actor_position AS "actorPosition",
           from_status AS "fromStatus",
           to_status AS "toStatus",
           note,
           reason,
           metadata
    FROM v_request_timeline
    WHERE request_id = ${requestId}::uuid
    ORDER BY created_at ASC, id ASC
  `)) as any[]

  // 4. Ambil ringkasan tahapan (Stepper) dari approval_tasks + assignees
  const taskRows = (await db.execute(sql`
    SELECT t.id,
           t.step_order AS "stepOrder",
           t.step_name AS "stepName",
           t.status,
           t.started_at AS "startedAt",
           t.due_at AS "dueAt",
           t.decided_at AS "decidedAt",
           t.reminder_count AS "reminderCount",
           t.reassigned_from_id AS "reassignedFromId",
           COALESCE(
             json_agg(
               json_build_object(
                 'employeeId', e.id,
                 'fullName', e.full_name,
                 'nip', e.nip,
                 'positionName', p.name,
                 'response', a.response,
                 'respondedAt', a.responded_at,
                 'responseNote', a.response_note,
                 'isDelegate', a.is_delegate
               )
             ) FILTER (WHERE e.id IS NOT NULL),
             '[]'
           ) AS assignees
    FROM approvals.approval_tasks t
    LEFT JOIN approvals.approval_task_assignees a ON a.task_id = t.id
    LEFT JOIN org.employees e ON e.id = a.employee_id
    LEFT JOIN org.positions p ON p.id = e.position_id
    WHERE t.request_id = ${requestId}::uuid
    GROUP BY t.id, t.step_order, t.step_name, t.status, t.started_at, t.due_at, t.decided_at, t.reminder_count, t.reassigned_from_id
    ORDER BY t.step_order ASC
  `)) as any[]

  // Hitung sisa jam kerja untuk task PENDING
  let calendar = null
  try {
    calendar = await loadWorkingCalendar()
  } catch {}

  const steps = taskRows.map((t) => {
    let remainingTimeText = '-'
    let isOverdue = false

    if (t.status === 'PENDING' && t.dueAt && calendar) {
      const now = new Date()
      const due = new Date(t.dueAt)
      if (due > now) {
        const hours = workingHoursBetween(now, due, calendar)
        const wholeHours = Math.floor(hours)
        const mins = Math.round((hours - wholeHours) * 60)
        remainingTimeText = mins > 0 ? `${wholeHours} jam ${mins} mnt kerja` : `${wholeHours} jam kerja`
      } else {
        remainingTimeText = 'Lewat batas SLA'
        isOverdue = true
      }
    }

    return {
      ...t,
      remainingTimeText,
      isOverdue,
    }
  })

  return {
    data: {
      requestId,
      requestNumber: req.request_number,
      status: req.status,
      timeline: timelineRows,
      steps,
    },
  }
})
