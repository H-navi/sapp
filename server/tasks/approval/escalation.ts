import { eq, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { runTaskWithLock } from '../_runner'
import * as schema from '../../database/schema'
import { loadWorkingCalendar, addWorkingHours } from '../../utils/working-time'
import { activateStep, finalizeRequest } from '../../services/approval'
import { queueNotification } from '../../services/notification/enqueue'

export default defineTask({
  meta: {
    name: 'approval:escalation',
    description: 'Eskalasi tahap persetujuan yang melewati batas waktu SLA',
  },
  async run() {
    return await runTaskWithLock('approval:escalation', 8002, async (db) => {
      const cal = await loadWorkingCalendar()
      const now = new Date()

      // 1. Cari tugas persetujuan pending yang due_at telah terlewati
      const overdueTasks = (await db.execute(sql`
        SELECT t.id,
               t.request_id,
               t.step_order,
               t.step_name,
               t.due_at,
               t.step_snapshot,
               r.request_number,
               r.employee_id AS requester_id,
               e.full_name AS requester_name
        FROM approval_tasks t
        JOIN leave_requests r ON r.id = t.request_id
        JOIN employees e ON e.id = r.employee_id
        WHERE t.status = 'PENDING'
          AND t.due_at IS NOT NULL
          AND t.due_at <= NOW()
          AND r.status IN ('SUBMITTED', 'IN_REVIEW')
        ORDER BY t.due_at ASC
        LIMIT 100
        FOR UPDATE OF t SKIP LOCKED
      `)) as any[]

      let processedCount = 0

      for (const t of overdueTasks) {
        try {
          await db.transaction(async (tx) => {
            const step = (t.step_snapshot || {}) as any
            const action = (step.escalationAction || 'AUTO_APPROVE') as string
            const slaHours = Number(step.slaHours ?? 8)
            const notifyAdmin = step.escalationNotifyAdmin ?? true

            const baseMetadata = {
              step_order: t.step_order,
              step_name: t.step_name,
              sla_hours: slaHours,
              original_due_at: t.due_at,
              escalation_action: action,
            }

            // Aksi 1: AUTO_APPROVE
            if (action === 'AUTO_APPROVE') {
              const actionNote = `Disetujui otomatis: melewati batas waktu SLA (${slaHours} jam kerja) tanpa tindakan.`

              await tx
                .update(schema.approvalTasks)
                .set({
                  status: 'APPROVED',
                  actedAt: now,
                  actionSource: 'SYSTEM_AUTO',
                  actionNote,
                  updatedAt: now,
                })
                .where(eq(schema.approvalTasks.id, t.id))

              await tx.insert(schema.approvalHistories).values({
                requestId: t.request_id,
                taskId: t.id,
                stepOrder: t.step_order,
                stepName: t.step_name,
                action: 'AUTO_APPROVED',
                actorType: 'SYSTEM',
                note: actionNote,
                metadata: baseMetadata,
              })

              // Cek apakah ada tahap berikutnya
              const nextSteps = (await tx.execute(sql`
                SELECT step_order
                FROM approval_tasks
                WHERE request_id = ${t.request_id}::uuid
                  AND status = 'WAITING'
                ORDER BY step_order ASC
                LIMIT 1
              `)) as any[]

              if (nextSteps.length > 0) {
                const nextOrder = Number(nextSteps[0].step_order)
                await tx
                  .update(schema.leaveRequests)
                  .set({ currentStepOrder: nextOrder, updatedAt: now })
                  .where(eq(schema.leaveRequests.id, t.request_id))

                await activateStep(tx, t.request_id, nextOrder)
              } else {
                // Tahap terakhir selesai -> finalizeRequest APPROVED
                await finalizeRequest(
                  tx,
                  t.request_id,
                  'APPROVED',
                  'SYSTEM_AUTO',
                  'Seluruh tahap persetujuan telah selesai (disetujui otomatis oleh sistem).'
                )
              }
            }

            // Aksi 2: AUTO_REJECT
            else if (action === 'AUTO_REJECT') {
              const actionNote = `Ditolak otomatis: batas waktu SLA tahap ${t.step_name} (${slaHours} jam) terlewati.`

              await tx
                .update(schema.approvalTasks)
                .set({
                  status: 'REJECTED',
                  actedAt: now,
                  actionSource: 'SYSTEM_AUTO',
                  actionNote,
                  updatedAt: now,
                })
                .where(eq(schema.approvalTasks.id, t.id))

              await tx.insert(schema.approvalHistories).values({
                requestId: t.request_id,
                taskId: t.id,
                stepOrder: t.step_order,
                stepName: t.step_name,
                action: 'AUTO_REJECTED',
                actorType: 'SYSTEM',
                note: actionNote,
                metadata: baseMetadata,
              })

              await finalizeRequest(
                tx,
                t.request_id,
                'REJECTED',
                'SYSTEM_AUTO',
                actionNote
              )
            }

            // Aksi 3: ESCALATE_NEXT_STEP
            else if (action === 'ESCALATE_NEXT_STEP') {
              const actionNote = `Tahap dieskalasi: melewati batas SLA (${slaHours} jam). Dialihkan ke tahap berikutnya.`

              await tx
                .update(schema.approvalTasks)
                .set({
                  status: 'ESCALATED',
                  actedAt: now,
                  actionSource: 'SYSTEM_ESCALATION',
                  actionNote,
                  updatedAt: now,
                })
                .where(eq(schema.approvalTasks.id, t.id))

              await tx.insert(schema.approvalHistories).values({
                requestId: t.request_id,
                taskId: t.id,
                stepOrder: t.step_order,
                stepName: t.step_name,
                action: 'ESCALATED',
                actorType: 'SYSTEM',
                note: actionNote,
                metadata: baseMetadata,
              })

              const nextSteps = (await tx.execute(sql`
                SELECT step_order
                FROM approval_tasks
                WHERE request_id = ${t.request_id}::uuid
                  AND status = 'WAITING'
                ORDER BY step_order ASC
                LIMIT 1
              `)) as any[]

              if (nextSteps.length > 0) {
                const nextOrder = Number(nextSteps[0].step_order)
                await tx
                  .update(schema.leaveRequests)
                  .set({ currentStepOrder: nextOrder, updatedAt: now })
                  .where(eq(schema.leaveRequests.id, t.request_id))

                await activateStep(tx, t.request_id, nextOrder)
              } else {
                // Bila tidak ada tahap berikutnya, perlakukan sebagai notifikasi admin
                await tx.insert(schema.approvalHistories).values({
                  requestId: t.request_id,
                  taskId: t.id,
                  stepOrder: t.step_order,
                  stepName: t.step_name,
                  action: 'ESCALATION_FAILED_NO_NEXT_STEP',
                  actorType: 'SYSTEM',
                  note: 'Tidak ada tahap berikutnya untuk eskalasi. Membutuhkan tindakan manual Admin.',
                  metadata: baseMetadata,
                })
              }
            }

            // Aksi 4: ESCALATE_TO_STEP
            else if (action === 'ESCALATE_TO_STEP') {
              const targetOrder = Number(step.escalateToStepOrder ?? (t.step_order + 1))
              const actionNote = `Tahap dieskalasi: melompat ke tahap urutan ${targetOrder}.`

              await tx
                .update(schema.approvalTasks)
                .set({
                  status: 'ESCALATED',
                  actedAt: now,
                  actionSource: 'SYSTEM_ESCALATION',
                  actionNote,
                  updatedAt: now,
                })
                .where(eq(schema.approvalTasks.id, t.id))

              // Lewati tahap di antaranya
              await tx.execute(sql`
                UPDATE approval_tasks
                SET status = 'SKIPPED', updated_at = NOW()
                WHERE request_id = ${t.request_id}::uuid
                  AND step_order > ${t.step_order}
                  AND step_order < ${targetOrder}
                  AND status = 'WAITING'
              `)

              await tx.insert(schema.approvalHistories).values({
                requestId: t.request_id,
                taskId: t.id,
                stepOrder: t.step_order,
                stepName: t.step_name,
                action: 'ESCALATED',
                actorType: 'SYSTEM',
                note: actionNote,
                metadata: { ...baseMetadata, target_step_order: targetOrder },
              })

              await tx
                .update(schema.leaveRequests)
                .set({ currentStepOrder: targetOrder, updatedAt: now })
                .where(eq(schema.leaveRequests.id, t.request_id))

              await activateStep(tx, t.request_id, targetOrder)
            }

            // Aksi 5: NOTIFY_ADMIN_ONLY
            else if (action === 'NOTIFY_ADMIN_ONLY') {
              // Perpanjang due_at 1 periode SLA lagi
              let newDueAt: Date
              if (step.slaUsesWorkingHours) {
                newDueAt = addWorkingHours(now, slaHours, cal)
              } else {
                newDueAt = dayjs(now).add(slaHours, 'hour').toDate()
              }

              await tx
                .update(schema.approvalTasks)
                .set({ dueAt: newDueAt, updatedAt: now })
                .where(eq(schema.approvalTasks.id, t.id))

              await tx.insert(schema.approvalHistories).values({
                requestId: t.request_id,
                taskId: t.id,
                stepOrder: t.step_order,
                stepName: t.step_name,
                action: 'SLA_BREACH_NOTIFIED',
                actorType: 'SYSTEM',
                note: `Batas waktu SLA terlampaui. Batas waktu diperpanjang hingga ${dayjs(newDueAt).format('D MMM YYYY HH:mm')}. Notifikasi diteruskan ke Admin.`,
                metadata: { ...baseMetadata, extended_due_at: newDueAt },
              })
            }

            // Aksi 6: KEEP_WAITING
            else if (action === 'KEEP_WAITING') {
              await tx
                .update(schema.approvalTasks)
                .set({ dueAt: null, updatedAt: now })
                .where(eq(schema.approvalTasks.id, t.id))

              await tx.insert(schema.approvalHistories).values({
                requestId: t.request_id,
                taskId: t.id,
                stepOrder: t.step_order,
                stepName: t.step_name,
                action: 'KEEP_WAITING',
                actorType: 'SYSTEM',
                note: 'Batas waktu SLA dilepaskan (menunggu tanpa batas waktu).',
                metadata: baseMetadata,
              })
            }

            // Kirim notifikasi eskalasi ke Admin jika diaktifkan
            if (notifyAdmin) {
              const dedupeKey = `escalated:${t.id}:${action}`
              await queueNotification(
                {
                  eventType: 'APPROVAL_ESCALATED',
                  channel: 'EMAIL',
                  recipientAddress: 'admin@perusahaan.co.id',
                  subject: `[Eskalasi SLA] Tahap ${t.step_name} #${t.request_number} (${t.requester_name})`,
                  body: `Tahap persetujuan ${t.step_name} untuk pengajuan #${t.request_number} (${t.requester_name}) telah melewati batas waktu SLA (${slaHours} jam) dan dieksekusi dengan aksi ${action}.`,
                  requestId: t.request_id,
                  taskId: t.id,
                  dedupeKey,
                  payload: {
                    ...baseMetadata,
                    requestNumber: t.request_number,
                    requesterName: t.requester_name,
                  },
                },
                tx
              )
            }
          })

          processedCount++
        } catch (itemErr: any) {
          console.error(`Gagal memproses eskalasi task ${t.id}:`, itemErr)
        }
      }

      return { processedCount }
    })
  },
})
