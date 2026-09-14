import { and, asc, desc, eq, sql } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { useDatabase } from '../../database'
import { ambilRequestContext, matchWorkflow } from './workflow-matcher'
import { resolveApprovers } from './approver-resolver'

/**
 * Kotak masuk tugas persetujuan milik approver (status PENDING).
 */
export async function getApproverInbox(
  employeeId: string,
  filter: 'all' | 'urgent' | 'overdue' = 'all'
) {
  const db = useDatabase()

  let filterCondition = sql`TRUE`
  if (filter === 'urgent') {
    filterCondition = sql`t.due_at < NOW() + interval '4 hours' AND t.due_at >= NOW()`
  } else if (filter === 'overdue') {
    filterCondition = sql`t.due_at < NOW()`
  }

  const rows = (await db.execute(sql`
    SELECT t.id AS task_id,
           t.request_id,
           t.step_order,
           t.step_name,
           t.approval_mode,
           t.status AS task_status,
           t.started_at,
           t.due_at,
           t.due_at < NOW() AS is_overdue,
           CASE
             WHEN t.due_at IS NOT NULL AND t.due_at > NOW()
             THEN EXTRACT(EPOCH FROM (t.due_at - NOW()))::int
             ELSE 0
           END AS remaining_seconds,
           ta.is_delegate,
           ta.delegated_from,
           r.request_number,
           r.start_date::text AS start_date,
           r.end_date::text AS end_date,
           r.total_days::numeric AS total_days,
           r.working_days::numeric AS working_days,
           r.reason,
           lt.id AS leave_type_id,
           lt.code AS leave_type_code,
           lt.name AS leave_type_name,
           lt.color AS leave_type_color,
           e.id AS requester_id,
           e.nip AS requester_nip,
           e.full_name AS requester_name,
           d.name AS department_name,
           pos.name AS position_name
    FROM approval_tasks t
    JOIN approval_task_assignees ta ON ta.task_id = t.id
    JOIN leave_requests r ON r.id = t.request_id
    JOIN leave_types lt ON lt.id = r.leave_type_id
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN positions pos ON pos.id = e.position_id
    WHERE ta.employee_id = ${employeeId}::uuid
      AND ta.response IS NULL
      AND t.status = 'PENDING'
      AND ${filterCondition}
    ORDER BY t.due_at ASC NULLS LAST, t.started_at ASC
  `)) as any[]

  return rows.map((r) => ({
    taskId: r.task_id,
    requestId: r.request_id,
    stepOrder: Number(r.step_order),
    stepName: r.step_name,
    approvalMode: r.approval_mode,
    taskStatus: r.task_status,
    startedAt: r.started_at,
    dueAt: r.due_at,
    isOverdue: Boolean(r.is_overdue),
    remainingSeconds: Number(r.remaining_seconds ?? 0),
    isDelegate: Boolean(r.is_delegate),
    delegatedFrom: r.delegated_from,
    requestNumber: r.request_number,
    startDate: r.start_date,
    endDate: r.end_date,
    totalDays: Number(r.total_days),
    workingDays: Number(r.working_days),
    reason: r.reason,
    leaveType: {
      id: r.leave_type_id,
      code: r.leave_type_code,
      name: r.leave_type_name,
      color: r.leave_type_color,
    },
    requester: {
      id: r.requester_id,
      nip: r.requester_nip,
      fullName: r.requester_name,
      departmentName: r.department_name,
      positionName: r.position_name,
    },
  }))
}

/**
 * Detail tugas persetujuan lengkap dengan matriks evaluasi aturan, lampiran, dan konteks tim.
 */
export async function getApprovalDetail(taskId: string, employeeId?: string) {
  const db = useDatabase()

  // 1. Data task dan permohonan
  const taskRows = (await db.execute(sql`
    SELECT t.id AS task_id,
           t.request_id,
           t.step_order,
           t.step_name,
           t.approval_mode,
           t.quorum_count,
           t.status AS task_status,
           t.started_at,
           t.due_at,
           t.acted_at,
           t.acted_by,
           t.action_note,
           r.id AS req_id,
           r.request_number,
           r.status AS request_status,
           r.start_date::text AS start_date,
           r.end_date::text AS end_date,
           r.start_day_part,
           r.end_day_part,
           r.total_days::numeric AS total_days,
           r.working_days::numeric AS working_days,
           r.reason,
           r.address_during_leave,
           r.contact_phone,
           r.submitted_at,
           r.final_deadline_at,
           lt.id AS leave_type_id,
           lt.code AS leave_type_code,
           lt.name AS leave_type_name,
           lt.color AS leave_type_color,
           e.id AS requester_id,
           e.nip AS requester_nip,
           e.full_name AS requester_name,
           e.gender AS requester_gender,
           e.employment_status AS requester_employment_status,
           d.id AS department_id,
           d.name AS department_name,
           pos.name AS position_name
    FROM approval_tasks t
    JOIN leave_requests r ON r.id = t.request_id
    JOIN leave_types lt ON lt.id = r.leave_type_id
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN positions pos ON pos.id = e.position_id
    WHERE t.id = ${taskId}::uuid
    LIMIT 1
  `)) as any[]

  if (taskRows.length === 0) {
    throw createError({ statusCode: 404, message: 'Tugas persetujuan tidak ditemukan' })
  }

  const row = taskRows[0]

  // 2. Assignees pada task ini
  const assignees = (await db.execute(sql`
    SELECT ta.id,
           ta.employee_id,
           e.full_name,
           ta.is_delegate,
           ta.delegated_from,
           ta.response,
           ta.response_note,
           ta.responded_at
    FROM approval_task_assignees ta
    JOIN employees e ON e.id = ta.employee_id
    WHERE ta.task_id = ${taskId}::uuid
  `)) as any[]

  // 3. Rincian tanggal hari izin
  const days = (await db.execute(sql`
    SELECT leave_date::text AS tanggal,
           day_part,
           day_value::numeric AS day_value,
           is_working_day,
           is_holiday
    FROM leave_request_days
    WHERE request_id = ${row.req_id}::uuid
    ORDER BY leave_date ASC
  `)) as any[]

  // 4. Berkas lampiran
  const attachments = (await db.execute(sql`
    SELECT id, file_name, file_path, mime_type, size_bytes
    FROM leave_request_attachments
    WHERE request_id = ${row.req_id}::uuid
  `)) as any[]

  // 5. Hasil evaluasi aturan (rule checks matrix)
  const ruleChecks = (await db.execute(sql`
    SELECT id, rule_code, rule_type, passed, violation_action, message, context, evaluated_at
    FROM leave_request_rule_checks
    WHERE request_id = ${row.req_id}::uuid
    ORDER BY id ASC
  `)) as any[]

  // 6. Riwayat seluruh tahap approval pada permohonan ini
  const allTasks = (await db.execute(sql`
    SELECT t.id,
           t.step_order,
           t.step_name,
           t.status,
           t.started_at,
           t.acted_at,
           t.action_note,
           e.full_name AS acted_by_name
    FROM approval_tasks t
    LEFT JOIN employees e ON e.id = t.acted_by
    WHERE t.request_id = ${row.req_id}::uuid
    ORDER BY t.step_order ASC
  `)) as any[]

  // 7. Konteks rekan sedepartemen yang juga izin pada rentang tanggal terkait
  const teamLeaves = row.department_id
    ? ((await db.execute(sql`
        SELECT DISTINCT e.full_name,
                        lt.name AS leave_type_name,
                        d.leave_date::text AS tanggal
        FROM leave_request_days d
        JOIN leave_requests r ON r.id = d.request_id
        JOIN employees e ON e.id = r.employee_id
        JOIN leave_types lt ON lt.id = r.leave_type_id
        WHERE e.department_id = ${row.department_id}::uuid
          AND r.employee_id <> ${row.requester_id}::uuid
          AND r.status IN ('SUBMITTED', 'IN_REVIEW', 'APPROVED')
          AND d.leave_date >= ${row.start_date}::date
          AND d.leave_date <= ${row.end_date}::date
        ORDER BY d.leave_date ASC
      `)) as any[])
    : []

  return {
    task: {
      id: row.task_id,
      stepOrder: Number(row.step_order),
      stepName: row.step_name,
      approvalMode: row.approval_mode,
      quorumCount: row.quorum_count != null ? Number(row.quorum_count) : null,
      status: row.task_status,
      startedAt: row.started_at,
      dueAt: row.due_at,
      actedAt: row.acted_at,
      actionNote: row.action_note,
      assignees: assignees.map((a) => ({
        id: a.id,
        employeeId: a.employee_id,
        fullName: a.full_name,
        isDelegate: Boolean(a.is_delegate),
        delegatedFrom: a.delegated_from,
        response: a.response,
        responseNote: a.response_note,
        respondedAt: a.responded_at,
      })),
    },
    request: {
      id: row.req_id,
      requestNumber: row.request_number,
      status: row.request_status,
      startDate: row.start_date,
      endDate: row.end_date,
      startDayPart: row.start_day_part,
      endDayPart: row.end_day_part,
      totalDays: Number(row.total_days),
      workingDays: Number(row.working_days),
      reason: row.reason,
      addressDuringLeave: row.address_during_leave,
      contactPhone: row.contact_phone,
      submittedAt: row.submitted_at,
      finalDeadlineAt: row.final_deadline_at,
      leaveType: {
        id: row.leave_type_id,
        code: row.leave_type_code,
        name: row.leave_type_name,
        color: row.leave_type_color,
      },
      requester: {
        id: row.requester_id,
        nip: row.requester_nip,
        fullName: row.requester_name,
        gender: row.requester_gender,
        employmentStatus: row.requester_employment_status,
        departmentName: row.department_name,
        positionName: row.position_name,
      },
    },
    days: days.map((d) => ({
      date: d.tanggal,
      dayPart: d.day_part,
      dayValue: Number(d.day_value),
      isWorkingDay: Boolean(d.is_working_day),
      isHoliday: Boolean(d.is_holiday),
    })),
    attachments: attachments.map((att) => ({
      id: att.id,
      fileName: att.file_name,
      filePath: att.file_path,
      mimeType: att.mime_type,
      sizeBytes: Number(att.size_bytes),
    })),
    ruleChecks: ruleChecks.map((rc) => ({
      id: rc.id,
      ruleCode: rc.rule_code,
      ruleType: rc.rule_type,
      passed: Boolean(rc.passed),
      violationAction: rc.violation_action,
      message: rc.message,
      context: rc.context,
      evaluatedAt: rc.evaluated_at,
    })),
    approvalSteps: allTasks.map((st) => ({
      id: st.id,
      stepOrder: Number(st.step_order),
      stepName: st.step_name,
      status: st.status,
      startedAt: st.started_at,
      actedAt: st.acted_at,
      actedByName: st.acted_by_name,
      actionNote: st.action_note,
    })),
    teamLeaves: teamLeaves.map((tl) => ({
      employeeName: tl.full_name,
      leaveTypeName: tl.leave_type_name,
      date: tl.tanggal,
    })),
  }
}

/**
 * Riwayat tugas yang sudah diproses oleh approver.
 */
export async function getApprovalHistory(employeeId: string, limit = 50) {
  const db = useDatabase()

  const rows = (await db.execute(sql`
    SELECT t.id AS task_id,
           t.request_id,
           t.step_name,
           t.status AS task_status,
           t.acted_at,
           t.action_note,
           ta.response,
           ta.response_note,
           ta.responded_at,
           r.request_number,
           r.start_date::text AS start_date,
           r.end_date::text AS end_date,
           r.total_days::numeric AS total_days,
           lt.name AS leave_type_name,
           lt.color AS leave_type_color,
           e.full_name AS requester_name,
           d.name AS department_name
    FROM approval_task_assignees ta
    JOIN approval_tasks t ON t.id = ta.task_id
    JOIN leave_requests r ON r.id = t.request_id
    JOIN leave_types lt ON lt.id = r.leave_type_id
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE ta.employee_id = ${employeeId}::uuid
      AND ta.response IS NOT NULL
    ORDER BY ta.responded_at DESC
    LIMIT ${limit}
  `)) as any[]

  return rows.map((r) => ({
    taskId: r.task_id,
    requestId: r.request_id,
    stepName: r.step_name,
    taskStatus: r.task_status,
    response: r.response,
    responseNote: r.response_note,
    respondedAt: r.responded_at,
    requestNumber: r.request_number,
    startDate: r.start_date,
    endDate: r.end_date,
    totalDays: Number(r.total_days),
    leaveTypeName: r.leave_type_name,
    leaveTypeColor: r.leave_type_color,
    requesterName: r.requester_name,
    departmentName: r.department_name,
  }))
}

/**
 * Daftar delegasi wewenang yang dibuat oleh pegawai.
 */
export async function getDelegations(employeeId: string) {
  const db = useDatabase()

  const rows = (await db.execute(sql`
    SELECT d.id,
           d.delegator_employee_id,
           d.delegate_employee_id,
           e.full_name AS delegate_name,
           e.nip AS delegate_nip,
           d.leave_type_id,
           lt.name AS leave_type_name,
           d.start_date::text AS start_date,
           d.end_date::text AS end_date,
           d.reason,
           d.is_active,
           d.created_at
    FROM approval_delegations d
    JOIN employees e ON e.id = d.delegate_employee_id
    LEFT JOIN leave_types lt ON lt.id = d.leave_type_id
    WHERE d.delegator_employee_id = ${employeeId}::uuid
    ORDER BY d.created_at DESC
  `)) as any[]

  return rows.map((r) => ({
    id: r.id,
    delegatorEmployeeId: r.delegator_employee_id,
    delegateEmployeeId: r.delegate_employee_id,
    delegateName: r.delegate_name,
    delegateNip: r.delegate_nip,
    leaveTypeId: r.leave_type_id,
    leaveTypeName: r.leave_type_name ?? 'Semua Jenis Izin',
    startDate: r.start_date,
    endDate: r.end_date,
    reason: r.reason,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
  }))
}

/**
 * Buat delegasi wewenang baru.
 */
export async function createDelegation(
  delegatorEmployeeId: string,
  input: {
    delegateEmployeeId: string
    leaveTypeId?: string | null
    startDate: string
    endDate: string
    reason?: string | null
  },
  userId?: string
) {
  const db = useDatabase()

  if (delegatorEmployeeId === input.delegateEmployeeId) {
    throw createError({ statusCode: 400, message: 'Tidak dapat mendelegasikan wewenang kepada diri sendiri' })
  }

  const [inserted] = await db
    .insert(schema.approvalDelegations)
    .values({
      delegatorEmployeeId,
      delegateEmployeeId: input.delegateEmployeeId,
      leaveTypeId: input.leaveTypeId ? input.leaveTypeId : null,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      createdBy: userId ? (userId as any) : null,
    })
    .returning()

  return inserted
}

/**
 * Cabut atau hapus delegasi wewenang.
 */
export async function deleteDelegation(delegationId: string, employeeId: string) {
  const db = useDatabase()

  const [deleted] = await db
    .delete(schema.approvalDelegations)
    .where(
      and(
        eq(schema.approvalDelegations.id, delegationId),
        eq(schema.approvalDelegations.delegatorEmployeeId, employeeId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Delegasi tidak ditemukan atau bukan milik Anda' })
  }

  return { success: true, id: deleted.id }
}

/**
 * Admin: Daftar seluruh alur persetujuan beserta ringkasan kriteria & jumlah tahap.
 */
export async function listAdminWorkflows() {
  const db = useDatabase()

  const rows = (await db.execute(sql`
    SELECT w.id,
           w.code,
           w.name,
           w.description,
           w.priority,
           w.version,
           w.effective_from::text AS effective_from,
           w.effective_to::text AS effective_to,
           w.is_active,
           w.min_days::numeric AS min_days,
           w.max_days::numeric AS max_days,
           w.employment_status,
           w.position_level_min,
           w.position_level_max,
           lt.name AS leave_type_name,
           lt.color AS leave_type_color,
           d.name AS department_name,
           count(s.id)::int AS steps_count
    FROM approval_workflows w
    LEFT JOIN leave_types lt ON lt.id = w.leave_type_id
    LEFT JOIN departments d ON d.id = w.department_id
    LEFT JOIN approval_workflow_steps s ON s.workflow_id = w.id
    GROUP BY w.id, lt.id, d.id
    ORDER BY w.priority ASC, w.code ASC
  `)) as any[]

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    priority: Number(r.priority),
    version: Number(r.version),
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    isActive: Boolean(r.is_active),
    minDays: r.min_days != null ? Number(r.min_days) : null,
    maxDays: r.max_days != null ? Number(r.max_days) : null,
    employmentStatus: r.employment_status,
    positionLevelMin: r.position_level_min,
    positionLevelMax: r.position_level_max,
    leaveTypeName: r.leave_type_name ?? 'Semua Jenis Izin',
    leaveTypeColor: r.leave_type_color,
    departmentName: r.department_name ?? 'Semua Departemen',
    stepsCount: Number(r.steps_count ?? 0),
  }))
}

/**
 * Admin: Detail alur persetujuan beserta seluruh tahapnya.
 */
export async function getAdminWorkflowById(id: string) {
  const db = useDatabase()

  const [w] = await db
    .select()
    .from(schema.approvalWorkflows)
    .where(eq(schema.approvalWorkflows.id, id))
    .limit(1)

  if (!w) {
    throw createError({ statusCode: 404, message: 'Alur persetujuan tidak ditemukan' })
  }

  const steps = await db
    .select()
    .from(schema.approvalWorkflowSteps)
    .where(eq(schema.approvalWorkflowSteps.workflowId, id))
    .orderBy(asc(schema.approvalWorkflowSteps.stepOrder))

  return {
    workflow: w,
    steps,
  }
}

/**
 * Admin: Simulasi pencocokan alur dan resolusi approver untuk pengujian konfigurasi.
 */
export async function previewWorkflowSimulation(input: {
  employeeId: string
  leaveTypeId: string
  totalDays: number
}) {
  const db = useDatabase()

  // Bangun context dummy untuk pegawai ini
  const empRows = (await db.execute(sql`
    SELECT e.id,
           e.full_name,
           e.department_id,
           e.position_id,
           p.level AS position_level,
           e.manager_id,
           e.employment_status
    FROM employees e
    LEFT JOIN positions p ON p.id = e.position_id
    WHERE e.id = ${input.employeeId}::uuid
    LIMIT 1
  `)) as any[]

  if (empRows.length === 0) {
    throw createError({ statusCode: 404, message: 'Pegawai tidak ditemukan' })
  }

  const emp = empRows[0]
  const dummyContext = {
    id: '00000000-0000-0000-0000-000000000000',
    requestNumber: 'SIMULATION',
    leaveTypeId: input.leaveTypeId,
    totalDays: input.totalDays,
    workingDays: input.totalDays,
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date().toISOString().substring(0, 10),
    employee: {
      id: emp.id,
      fullName: emp.full_name,
      departmentId: emp.department_id,
      positionId: emp.position_id,
      positionLevel: emp.position_level != null ? Number(emp.position_level) : null,
      managerId: emp.manager_id,
      employmentStatus: emp.employment_status,
    },
  }

  // 1. Cocokkan alur
  const workflow = await matchWorkflow(db, dummyContext)

  // 2. Saring tahap aktif sesuai durasi
  const activeSteps = workflow.steps.filter(
    (s) => s.conditionMinDays == null || input.totalDays >= Number(s.conditionMinDays)
  )

  // 3. Resolusi nama approver untuk tiap tahap
  const resolvedSteps = []
  for (const s of activeSteps) {
    const candidates = await resolveApprovers(db, s, dummyContext)
    const empDetails =
      candidates.length > 0
        ? ((await db.execute(sql`
            SELECT e.id, e.full_name, e.nip, d.name AS department_name, p.name AS position_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE e.id = ANY(ARRAY[${sql.join(candidates.map((c) => sql`${c.employeeId}::uuid`), sql`, `)}])
          `)) as any[])
        : []

    resolvedSteps.push({
      stepOrder: s.stepOrder,
      stepName: s.name,
      approverType: s.approverType,
      approvalMode: s.approvalMode,
      slaHours: s.slaHours,
      candidates: candidates.map((c) => {
        const detail = empDetails.find((d) => d.id === c.employeeId)
        return {
          employeeId: c.employeeId,
          fullName: detail?.full_name ?? c.employeeId,
          nip: detail?.nip,
          departmentName: detail?.department_name,
          positionName: detail?.position_name,
          isDelegate: c.isDelegate,
          delegatedFrom: c.delegatedFrom,
        }
      }),
    })
  }

  return {
    matchedWorkflow: {
      id: workflow.id,
      code: workflow.code,
      name: workflow.name,
      priority: workflow.priority,
    },
    resolvedSteps,
  }
}
