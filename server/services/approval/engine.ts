import { eq, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import * as schema from '../../database/schema'
import { useDatabase } from '../../database'
import type { RequestContext, TaskActionResult, WorkflowStepSnapshot } from './types'
import { ambilRequestContext, matchWorkflow } from './workflow-matcher'
import { resolveApprovers } from './approver-resolver'
import { finalizeRequest } from './decision'
import { loadWorkingCalendar, addWorkingHours, isWithinWorkingHours, nextWorkingMoment } from '../../utils/working-time'

/**
 * Memulai alur persetujuan saat pengajuan disubmit.
 */
export async function startApprovalFlow(tx: any, requestId: string): Promise<void> {
  const request = await ambilRequestContext(tx, requestId)
  const workflow = await matchWorkflow(tx, request)

  // 1. Simpan workflow snapshot ke leave_requests
  await tx
    .update(schema.leaveRequests)
    .set({
      workflowId: workflow.id,
      workflowSnapshot: workflow as any,
      updatedAt: new Date(),
    })
    .where(eq(schema.leaveRequests.id, requestId))

  // 2. Saring tahap yang memenuhi kondisi durasi minimal
  const langkah = workflow.steps
    .filter((s) => s.conditionMinDays == null || request.totalDays >= Number(s.conditionMinDays))
    .sort((a, b) => a.stepOrder - b.stepOrder)

  // Bila alur tidak memiliki tahap sama sekali -> langsung setujui otomatis
  if (langkah.length === 0) {
    return await finalizeRequest(
      tx,
      requestId,
      'APPROVED',
      'SYSTEM_AUTO',
      'Jenis izin ini tidak memerlukan persetujuan tambahan.'
    )
  }

  // 3. Masukkan seluruh tahap ke approval_tasks dengan status awal WAITING
  for (const s of langkah) {
    await tx.insert(schema.approvalTasks).values({
      requestId,
      workflowStepId: s.id,
      stepOrder: s.stepOrder,
      stepName: s.name,
      approvalMode: s.approvalMode as any,
      quorumCount: s.quorumCount,
      status: 'WAITING',
      stepSnapshot: s as any,
    })
  }

  // 4. Ubah status pengajuan menjadi IN_REVIEW pada tahap pertama
  const firstStep = langkah[0]!
  await tx
    .update(schema.leaveRequests)
    .set({
      status: 'IN_REVIEW',
      currentStepOrder: firstStep.stepOrder,
      updatedAt: new Date(),
    })
    .where(eq(schema.leaveRequests.id, requestId))

  // 5. Aktifkan tahap pertama
  await activateStep(tx, requestId, firstStep.stepOrder, request)
}

/**
 * Mengaktifkan tahap persetujuan (status PENDING), menghitung SLA, dan mengisi assignees.
 */
export async function activateStep(
  tx: any,
  requestId: string,
  stepOrder: number,
  preloadedRequest?: RequestContext
): Promise<void> {
  const taskRows = (await tx.execute(sql`
    SELECT id, step_name, approval_mode, quorum_count, step_snapshot
    FROM approval_tasks
    WHERE request_id = ${requestId}::uuid
      AND step_order = ${stepOrder}::smallint
    LIMIT 1
  `)) as any[]

  if (taskRows.length === 0) return

  const task = taskRows[0]
  const step = task.step_snapshot as WorkflowStepSnapshot

  // Hitung batas SLA (due_at)
  const now = new Date()
  const cal = await loadWorkingCalendar()
  let dueAt: Date
  if (step.slaUsesWorkingHours) {
    dueAt = addWorkingHours(now, step.slaHours, cal)
  } else {
    dueAt = dayjs(now).add(step.slaHours, 'hour').toDate()
  }

  let nextReminderAt: Date | null = null
  if (step.reminderEnabled && step.reminderIntervalMinutes > 0) {
    let nextRem = dayjs(now).add(step.reminderIntervalMinutes, 'minute').toDate()
    if (step.reminderOnlyWorkingHours && !isWithinWorkingHours(nextRem, cal)) {
      nextRem = nextWorkingMoment(nextRem, cal)
    }
    nextReminderAt = nextRem
  }

  // Perbarui task menjadi PENDING
  await tx
    .update(schema.approvalTasks)
    .set({
      status: 'PENDING',
      startedAt: now,
      dueAt,
      nextReminderAt,
      updatedAt: now,
    })
    .where(eq(schema.approvalTasks.id, task.id))

  const request = preloadedRequest ?? (await ambilRequestContext(tx, requestId))

  // Resolusi kandidat approver
  const candidates = await resolveApprovers(tx, step, request)

  // Penanganan jika kandidat kosong
  if (candidates.length === 0) {
    if (step.isOptional) {
      // Lewati tahap opsional
      await tx
        .update(schema.approvalTasks)
        .set({ status: 'SKIPPED', updatedAt: now })
        .where(eq(schema.approvalTasks.id, task.id))

      await tx.insert(schema.approvalHistories).values({
        requestId,
        taskId: task.id,
        stepOrder: step.stepOrder,
        stepName: step.name,
        action: 'SKIPPED',
        actorType: 'SYSTEM',
        note: 'Tahap dilewati otomatis karena bersifat opsional dan tidak ada approver.',
      })

      // Cari tahap berikutnya
      const nextRows = (await tx.execute(sql`
        SELECT step_order
        FROM approval_tasks
        WHERE request_id = ${requestId}::uuid
          AND status = 'WAITING'
        ORDER BY step_order ASC
        LIMIT 1
      `)) as any[]

      if (nextRows.length > 0) {
        await tx
          .update(schema.leaveRequests)
          .set({ currentStepOrder: Number(nextRows[0].step_order), updatedAt: now })
          .where(eq(schema.leaveRequests.id, requestId))

        return await activateStep(tx, requestId, Number(nextRows[0].step_order), request)
      } else {
        return await finalizeRequest(
          tx,
          requestId,
          'APPROVED',
          'SYSTEM_AUTO',
          'Seluruh tahap persetujuan telah selesai.'
        )
      }
    } else {
      // Tahap wajib tapi approver kosong -> tetap PENDING, notifikasi admin, JANGAN auto-approve
      await tx.insert(schema.approvalHistories).values({
        requestId,
        taskId: task.id,
        stepOrder: step.stepOrder,
        stepName: step.name,
        action: 'ASSIGNEE_EMPTY',
        actorType: 'SYSTEM',
        note: 'Kandidat approver tidak ditemukan pada hierarki. Diperlukan penanganan Admin.',
      })
      return
    }
  }

  // Isi assignees
  for (const c of candidates) {
    await tx.insert(schema.approvalTaskAssignees).values({
      taskId: task.id,
      employeeId: c.employeeId,
      isDelegate: c.isDelegate,
      delegatedFrom: c.delegatedFrom,
    })
  }

  // Catat riwayat penugasan
  await tx.insert(schema.approvalHistories).values({
    requestId,
    taskId: task.id,
    stepOrder: step.stepOrder,
    stepName: step.name,
    action: 'ASSIGNED',
    actorType: 'SYSTEM',
    note: `Tugas persetujuan ditugaskan kepada ${candidates.length} penerima tugas.`,
    metadata: {
      candidates: candidates.map((c) => ({
        employeeId: c.employeeId,
        isDelegate: c.isDelegate,
      })),
    },
  })
}

/**
 * Tindakan approver pada tugas persetujuan (APPROVE atau REJECT).
 * Dilindungi dengan SELECT ... FOR UPDATE untuk mencegah race condition.
 */
export async function actOnTask(input: {
  taskId: string
  actorEmployeeId: string
  action: 'APPROVE' | 'REJECT'
  note?: string
}): Promise<TaskActionResult> {
  const db = useDatabase()

  return await db.transaction(async (tx) => {
    // 1. Kunci baris approval_tasks dengan FOR UPDATE
    const taskRows = (await tx.execute(sql`
      SELECT t.id,
             t.request_id,
             t.step_order,
             t.step_name,
             t.approval_mode,
             t.quorum_count,
             t.status,
             t.acted_at,
             t.acted_by,
             e.full_name AS acted_by_name
      FROM approval_tasks t
      LEFT JOIN employees e ON e.id = t.acted_by
      WHERE t.id = ${input.taskId}::uuid
      FOR UPDATE
    `)) as any[]

    if (taskRows.length === 0) {
      throw createError({ statusCode: 404, message: 'Tugas persetujuan tidak ditemukan' })
    }

    const task = taskRows[0]

    // 2. Pastikan status masih PENDING
    if (task.status !== 'PENDING') {
      const actorName = task.acted_by_name || 'approver lain'
      const waktu = task.acted_at ? dayjs(task.acted_at).format('D MMMM YYYY HH:mm') : 'sebelumnya'
      throw createError({
        statusCode: 409,
        statusMessage: 'APPROVAL_TASK_CLOSED',
        message: `Tugas ini sudah diproses oleh ${actorName} pada ${waktu}.`,
      })
    }

    // 3. Pastikan pelaku terdaftar di assignees dan belum merespons
    const assigneeRows = (await tx.execute(sql`
      SELECT id, is_delegate, delegated_from, response
      FROM approval_task_assignees
      WHERE task_id = ${input.taskId}::uuid
        AND employee_id = ${input.actorEmployeeId}::uuid
      LIMIT 1
    `)) as any[]

    if (assigneeRows.length === 0) {
      throw createError({
        statusCode: 403,
        statusMessage: 'AUTH_FORBIDDEN',
        message: 'Anda tidak memiliki hak wewenang untuk tugas persetujuan ini.',
      })
    }

    const assignee = assigneeRows[0]
    if (assignee.response !== null) {
      throw createError({
        statusCode: 400,
        message: 'Anda sudah memberikan respons pada tugas ini sebelumnya.',
      })
    }

    // Catatan wajib jika tindakan adalah REJECT
    if (input.action === 'REJECT' && (!input.note || input.note.trim().length < 10)) {
      throw createError({
        statusCode: 422,
        message: 'Catatan alasan penolakan wajib diisi (minimal 10 karakter).',
      })
    }

    // 4. Perbarui baris assignee
    const responseStatus = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    await tx.execute(sql`
      UPDATE approval_task_assignees
      SET responded_at = NOW(),
          response = ${responseStatus}::approval_task_status_enum,
          response_note = ${input.note ?? null}
      WHERE id = ${assignee.id}::uuid
    `)

    // 5. Jika REJECT -> batalkan tahap dan selesaikan pengajuan
    if (input.action === 'REJECT') {
      await tx.execute(sql`
        UPDATE approval_tasks
        SET status = 'REJECTED',
            acted_at = NOW(),
            acted_by = ${input.actorEmployeeId}::uuid,
            action_source = 'USER',
            action_note = ${input.note ?? null},
            updated_at = NOW()
        WHERE id = ${input.taskId}::uuid
      `)

      await tx.insert(schema.approvalHistories).values({
        requestId: task.request_id,
        taskId: task.id,
        stepOrder: task.step_order,
        stepName: task.step_name,
        actorEmployeeId: input.actorEmployeeId,
        actorType: 'USER',
        action: 'REJECTED',
        note: input.note,
      })

      await finalizeRequest(
        tx,
        task.request_id,
        'REJECTED',
        'USER',
        input.note ?? 'Ditolak oleh approver',
        input.actorEmployeeId
      )

      return {
        success: true,
        stepCompleted: true,
        requestStatus: 'REJECTED',
        message: 'Pengajuan telah ditolak.',
      }
    }

    // 6. Jika APPROVE -> evaluasi mode persetujuan (ANY_ONE, ALL, QUORUM)
    const countsRows = (await tx.execute(sql`
      SELECT count(*) FILTER (WHERE response = 'APPROVED')::int AS approved_count,
             count(*) FILTER (WHERE response IS NULL)::int AS pending_count,
             count(*)::int AS total_count
      FROM approval_task_assignees
      WHERE task_id = ${input.taskId}::uuid
    `)) as any[]

    const approvedCount = Number(countsRows[0]?.approved_count ?? 0)
    const pendingCount = Number(countsRows[0]?.pending_count ?? 0)

    let isStepComplete = false
    const mode = task.approval_mode

    if (mode === 'ANY_ONE') {
      isStepComplete = true
    } else if (mode === 'ALL') {
      isStepComplete = pendingCount === 0
    } else if (mode === 'QUORUM') {
      const quorumNeed = Number(task.quorum_count ?? 1)
      isStepComplete = approvedCount >= quorumNeed
    }

    if (!isStepComplete) {
      // Tahap belum selesai (masih butuh approver lain)
      await tx.insert(schema.approvalHistories).values({
        requestId: task.request_id,
        taskId: task.id,
        stepOrder: task.step_order,
        stepName: task.step_name,
        actorEmployeeId: input.actorEmployeeId,
        actorType: 'USER',
        action: 'APPROVED_PARTIAL',
        note: input.note,
      })

      return {
        success: true,
        stepCompleted: false,
        requestStatus: 'IN_REVIEW',
        message: 'Persetujuan Anda telah dicatat. Menunggu persetujuan approver lainnya.',
      }
    }

    // 7. Tahap selesai disetujui!
    await tx.execute(sql`
      UPDATE approval_tasks
      SET status = 'APPROVED',
          acted_at = NOW(),
          acted_by = ${input.actorEmployeeId}::uuid,
          action_source = 'USER',
          action_note = ${input.note ?? null},
          updated_at = NOW()
      WHERE id = ${input.taskId}::uuid
    `)

    await tx.insert(schema.approvalHistories).values({
      requestId: task.request_id,
      taskId: task.id,
      stepOrder: task.step_order,
      stepName: task.step_name,
      actorEmployeeId: input.actorEmployeeId,
      actorType: 'USER',
      action: 'STEP_APPROVED',
      note: input.note,
    })

    // 8. Cari tahap berikutnya
    const nextSteps = (await tx.execute(sql`
      SELECT step_order
      FROM approval_tasks
      WHERE request_id = ${task.request_id}::uuid
        AND status = 'WAITING'
      ORDER BY step_order ASC
      LIMIT 1
    `)) as any[]

    if (nextSteps.length > 0) {
      const nextOrder = Number(nextSteps[0].step_order)
      await tx
        .update(schema.leaveRequests)
        .set({
          currentStepOrder: nextOrder,
          updatedAt: new Date(),
        })
        .where(eq(schema.leaveRequests.id, task.request_id))

      await activateStep(tx, task.request_id, nextOrder)

      return {
        success: true,
        stepCompleted: true,
        requestStatus: 'IN_REVIEW',
        message: 'Tahap telah disetujui, beralih ke tahap berikutnya.',
      }
    } else {
      // Seluruh tahap selesai -> APPROVED final
      await finalizeRequest(
        tx,
        task.request_id,
        'APPROVED',
        'USER',
        'Seluruh tahap persetujuan telah selesai dan disetujui.',
        input.actorEmployeeId
      )

      return {
        success: true,
        stepCompleted: true,
        requestStatus: 'APPROVED',
        message: 'Pengajuan telah disetujui sepenuhnya.',
      }
    }
  })
}
