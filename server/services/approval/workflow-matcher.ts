import { sql } from 'drizzle-orm'
import type { RequestContext, WorkflowSnapshot, WorkflowStepSnapshot } from './types'

/**
 * Ambil konteks lengkap permohonan izin untuk pencocokan alur approval.
 */
export async function ambilRequestContext(tx: any, requestId: string): Promise<RequestContext> {
  const rows = (await tx.execute(sql`
    SELECT r.id,
           r.request_number,
           r.leave_type_id,
           r.total_days::numeric AS total_days,
           r.working_days::numeric AS working_days,
           r.start_date::text AS start_date,
           r.end_date::text AS end_date,
           e.id AS emp_id,
           e.full_name AS emp_name,
           e.department_id,
           e.position_id,
           p.level AS position_level,
           e.manager_id,
           e.employment_status
    FROM leave_requests r
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN positions p ON p.id = e.position_id
    WHERE r.id = ${requestId}::uuid
    LIMIT 1
  `)) as any[]

  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Permohonan izin tidak ditemukan' })
  }

  const r = rows[0]
  return {
    id: r.id,
    requestNumber: r.request_number,
    leaveTypeId: r.leave_type_id,
    totalDays: Number(r.total_days),
    workingDays: Number(r.working_days),
    startDate: r.start_date,
    endDate: r.end_date,
    employee: {
      id: r.emp_id,
      fullName: r.emp_name,
      departmentId: r.department_id,
      positionId: r.position_id,
      positionLevel: r.position_level != null ? Number(r.position_level) : null,
      managerId: r.manager_id,
      employmentStatus: r.employment_status,
    },
  }
}

/**
 * Mencari satu alur persetujuan yang paling spesifik dan aktif.
 * Jika tidak ada alur yang cocok, lemparkan APPROVAL_NO_WORKFLOW (jangan auto-approve).
 */
export async function matchWorkflow(tx: any, request: RequestContext): Promise<WorkflowSnapshot> {
  const leaveTypeId = request.leaveTypeId
  const deptId = request.employee.departmentId
  const status = request.employee.employmentStatus
  const posLevel = request.employee.positionLevel
  const totalDays = request.totalDays

  const workflows = (await tx.execute(sql`
    SELECT w.id,
           w.code,
           w.name,
           w.description,
           w.leave_type_id,
           w.department_id,
           w.priority,
           w.version
    FROM approval_workflows w
    WHERE w.is_active = true
      AND w.effective_from <= CURRENT_DATE
      AND (w.effective_to IS NULL OR w.effective_to >= CURRENT_DATE)
      AND (w.leave_type_id IS NULL OR w.leave_type_id = ${leaveTypeId}::uuid)
      AND (w.department_id IS NULL OR w.department_id = ${deptId ? sql`${deptId}::uuid` : sql`NULL::uuid`})
      AND (w.employment_status IS NULL OR w.employment_status = ${status}::employment_status_enum)
      AND (w.position_level_min IS NULL OR w.position_level_min <= ${posLevel != null ? posLevel : 1})
      AND (w.position_level_max IS NULL OR w.position_level_max >= ${posLevel != null ? posLevel : 99})
      AND (w.min_days IS NULL OR w.min_days <= ${totalDays})
      AND (w.max_days IS NULL OR w.max_days >= ${totalDays})
    ORDER BY w.priority ASC,
             (w.leave_type_id IS NOT NULL) DESC,
             (w.department_id IS NOT NULL) DESC,
             w.version DESC
    LIMIT 1
  `)) as any[]

  if (workflows.length === 0) {
    throw createError({
      statusCode: 422,
      statusMessage: 'APPROVAL_NO_WORKFLOW',
      message: 'Alur persetujuan untuk jenis izin ini belum dikonfigurasi. Hubungi admin.',
    })
  }

  const w = workflows[0]

  // Ambil seluruh tahap dari alur terpilih
  const steps = (await tx.execute(sql`
    SELECT s.id,
           s.workflow_id,
           s.step_order,
           s.name,
           s.approver_type,
           s.approver_position_id,
           s.approver_position_level,
           s.approver_employee_id,
           s.approver_role_id,
           s.approval_mode,
           s.quorum_count,
           s.is_optional,
           s.skip_if_requester,
           s.skip_if_already_approved,
           s.condition_min_days,
           s.condition_expression,
           s.sla_hours::numeric AS sla_hours,
           s.sla_uses_working_hours,
           s.reminder_enabled,
           s.reminder_interval_minutes,
           s.reminder_max_count,
           s.reminder_channels,
           s.escalation_action,
           s.escalate_to_step_order,
           s.escalation_notify_admin,
           s.allow_delegation
    FROM approval_workflow_steps s
    WHERE s.workflow_id = ${w.id}::uuid
    ORDER BY s.step_order ASC
  `)) as any[]

  const stepSnapshots: WorkflowStepSnapshot[] = steps.map((s) => ({
    id: s.id,
    workflowId: s.workflow_id,
    stepOrder: Number(s.step_order),
    name: s.name,
    approverType: s.approver_type,
    approverPositionId: s.approver_position_id,
    approverPositionLevel: s.approver_position_level != null ? Number(s.approver_position_level) : null,
    approverEmployeeId: s.approver_employee_id,
    approverRoleId: s.approver_role_id,
    approvalMode: s.approval_mode,
    quorumCount: s.quorum_count != null ? Number(s.quorum_count) : null,
    isOptional: Boolean(s.is_optional),
    skipIfRequester: Boolean(s.skip_if_requester),
    skipIfAlreadyApproved: Boolean(s.skip_if_already_approved),
    conditionMinDays: s.condition_min_days != null ? Number(s.condition_min_days) : null,
    conditionExpression: s.condition_expression,
    slaHours: Number(s.sla_hours),
    slaUsesWorkingHours: Boolean(s.sla_uses_working_hours),
    reminderEnabled: Boolean(s.reminder_enabled),
    reminderIntervalMinutes: Number(s.reminder_interval_minutes),
    reminderMaxCount: Number(s.reminder_max_count),
    reminderChannels: s.reminder_channels ?? ['EMAIL', 'TELEGRAM'],
    escalationAction: s.escalation_action,
    escalateToStepOrder: s.escalate_to_step_order != null ? Number(s.escalate_to_step_order) : null,
    escalationNotifyAdmin: Boolean(s.escalation_notify_admin),
    allowDelegation: Boolean(s.allow_delegation),
  }))

  return {
    id: w.id,
    code: w.code,
    name: w.name,
    description: w.description,
    leaveTypeId: w.leave_type_id,
    departmentId: w.department_id,
    priority: Number(w.priority),
    version: Number(w.version),
    steps: stepSnapshots,
  }
}
