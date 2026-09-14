import { eq, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { runTaskWithLock } from '../_runner'
import * as schema from '../../database/schema'
import { loadWorkingCalendar, addWorkingHours } from '../../utils/working-time'
import { evaluateRules } from '../../services/rules'
import { finalizeRequest } from '../../services/approval'
import { queueNotification } from '../../services/notification/enqueue'

export default defineTask({
  meta: {
    name: 'approval:auto-decision',
    description: 'Eksekusi keputusan otomatis pengajuan yang melewati batas waktu akhir',
  },
  async run() {
    return await runTaskWithLock('approval:auto-decision', 8003, async (db) => {
      const cal = await loadWorkingCalendar()
      const now = new Date()

      // 1. Ambil pengajuan yang melewati final_deadline_at
      const expiredRequests = (await db.execute(sql`
        SELECT r.id,
               r.request_number,
               r.employee_id,
               r.leave_type_id,
               r.policy_id,
               r.start_date::text AS start_date,
               r.end_date::text AS end_date,
               r.total_days::numeric AS total_days,
               r.working_days::numeric AS working_days,
               r.policy_snapshot,
               r.metadata,
               e.full_name AS requester_name,
               e.email AS requester_email,
               e.telegram_chat_id AS requester_telegram,
               lt.name AS leave_type_name
        FROM leave_requests r
        JOIN employees e ON e.id = r.employee_id
        JOIN leave_types lt ON lt.id = r.leave_type_id
        WHERE r.status IN ('SUBMITTED', 'IN_REVIEW')
          AND r.final_deadline_at IS NOT NULL
          AND r.final_deadline_at <= NOW()
        ORDER BY r.final_deadline_at ASC
        LIMIT 100
        FOR UPDATE OF r SKIP LOCKED
      `)) as any[]

      let processedCount = 0

      for (const r of expiredRequests) {
        try {
          await db.transaction(async (tx) => {
            const policy = (r.policy_snapshot || {}) as any
            const onDeadlineAction = (policy.onDeadlineAction || 'AUTO_APPROVE') as string
            const overallHours = Number(policy.overallDeadlineHours ?? 24)
            const deadlineUsesWorkingHours = policy.deadlineUsesWorkingHours ?? true

            // 2. Aksi Khusus: KEEP_WAITING atau NOTIFY_ADMIN_ONLY
            if (onDeadlineAction === 'KEEP_WAITING') {
              await tx
                .update(schema.leaveRequests)
                .set({ finalDeadlineAt: null, updatedAt: now })
                .where(eq(schema.leaveRequests.id, r.id))

              await tx.insert(schema.approvalHistories).values({
                requestId: r.id,
                action: 'KEEP_WAITING',
                actorType: 'SYSTEM',
                note: 'Batas waktu pengajuan dilepaskan (menunggu keputusan manual tanpa batas waktu).',
              })
              return
            }

            if (onDeadlineAction === 'NOTIFY_ADMIN_ONLY') {
              let nextDeadline: Date
              if (deadlineUsesWorkingHours) {
                nextDeadline = addWorkingHours(now, overallHours, cal)
              } else {
                nextDeadline = dayjs(now).add(overallHours, 'hour').toDate()
              }

              await tx
                .update(schema.leaveRequests)
                .set({ finalDeadlineAt: nextDeadline, updatedAt: now })
                .where(eq(schema.leaveRequests.id, r.id))

              await tx.insert(schema.approvalHistories).values({
                requestId: r.id,
                action: 'DEADLINE_EXTENDED',
                actorType: 'SYSTEM',
                note: `Batas waktu pengajuan terlewati. Diperpanjang satu siklus (${overallHours} jam) hingga ${dayjs(nextDeadline).format('D MMM YYYY HH:mm')}. Notifikasi diteruskan ke Admin.`,
              })

              // Antre notifikasi ke Admin
              await queueNotification(
                {
                  eventType: 'APPROVAL_ESCALATED',
                  channel: 'EMAIL',
                  recipientAddress: 'admin@perusahaan.co.id',
                  subject: `[Batas Waktu Pengajuan] #${r.request_number} (${r.requester_name})`,
                  body: `Pengajuan #${r.request_number} (${r.requester_name}) telah melewati batas waktu akhir (${overallHours} jam) dan diperpanjang karena kebijakan NOTIFY_ADMIN_ONLY.`,
                  requestId: r.id,
                  dedupeKey: `deadline_notify_admin:${r.id}:${Math.floor(now.getTime() / 3600000)}`,
                  payload: {
                    requestId: r.id,
                    requestNumber: r.request_number,
                    requesterName: r.requester_name,
                  },
                },
                tx
              )
              return
            }

            // Hitung lampiran
            const attRows = (await tx.execute(sql`
              SELECT count(*)::int AS count
              FROM leave_request_attachments
              WHERE request_id = ${r.id}::uuid
            `)) as any[]
            const attachmentCount = Number(attRows[0]?.count ?? 0)

            // 3. Evaluasi ULANG aturan dengan phase='AUTO_DECISION'
            const hasil = await evaluateRules({
              tx,
              employeeId: r.employee_id,
              leaveTypeId: r.leave_type_id,
              policyId: r.policy_id,
              startDate: r.start_date,
              endDate: r.end_date,
              totalDays: Number(r.total_days),
              workingDays: Number(r.working_days),
              attachmentCount,
              phase: 'AUTO_DECISION',
              excludeRequestId: r.id,
            })

            // 4. Catat seluruh hasil ke leave_request_rule_checks (phase='AUTO_DECISION')
            for (const d of hasil.details) {
              await tx.insert(schema.leaveRequestRuleChecks).values({
                requestId: r.id,
                ruleId: d.ruleId || null,
                ruleCode: d.ruleCode,
                ruleType: d.ruleType as any,
                passed: d.passed,
                violationAction: d.violationAction as any,
                message: d.message,
                context: d.context,
                evaluationPhase: 'AUTO_DECISION',
                evaluatedAt: now,
              })
            }

            // 5. Tentukan keputusan
            const autoDecisionRequiresRulePass = policy.autoDecisionRequiresRulePass ?? true

            // Kasus A: Wajib persetujuan manual (REQUIRE_APPROVAL)
            if (hasil.requiresManualApproval) {
              const currentBlockedCount = Number((r.metadata as any)?.auto_decision_blocked_count ?? 0)

              if (currentBlockedCount >= 2) {
                // Sudah 2x diperpanjang -> tetapkan status EXPIRED
                const expireReason = `Pengajuan kedaluwarsa setelah perpanjangan maksimum (aturan membutuhkan persetujuan manual approver).`
                await finalizeRequest(tx, r.id, 'EXPIRED', 'SYSTEM_AUTO', expireReason)

                await queueNotification(
                  {
                    eventType: 'REQUEST_EXPIRED',
                    channel: 'EMAIL',
                    recipientEmployeeId: r.employee_id,
                    recipientAddress: r.requester_email || r.employee_id,
                    subject: `[Kedaluwarsa] Pengajuan Izin #${r.request_number}`,
                    body: `Halo ${r.requester_name},\n\nPengajuan izin #${r.request_number} (${r.leave_type_name}) telah kedaluwarsa karena melewati batas waktu toleransi dan membutuhkan persetujuan manual yang belum diberikan.\n\nAlasan: ${expireReason}`,
                    requestId: r.id,
                    dedupeKey: `expired:${r.id}`,
                    payload: { requestId: r.id, requestNumber: r.request_number },
                  },
                  tx
                )
                return
              }

              // Perpanjang deadline 1x, notifikasi ADMIN + approver yang tertunda, catat action='AUTO_DECISION_BLOCKED'
              let nextDeadline: Date
              if (deadlineUsesWorkingHours) {
                nextDeadline = addWorkingHours(now, overallHours, cal)
              } else {
                nextDeadline = dayjs(now).add(overallHours, 'hour').toDate()
              }

              const newMetadata = {
                ...(r.metadata as any),
                auto_decision_blocked_count: currentBlockedCount + 1,
              }

              await tx
                .update(schema.leaveRequests)
                .set({
                  finalDeadlineAt: nextDeadline,
                  metadata: newMetadata,
                  updatedAt: now,
                })
                .where(eq(schema.leaveRequests.id, r.id))

              const blockedReasons = hasil.details
                .filter((d) => !d.passed && d.violationAction === 'REQUIRE_APPROVAL')
                .map((d) => d.message)
                .join('; ')

              await tx.insert(schema.approvalHistories).values({
                requestId: r.id,
                action: 'AUTO_DECISION_BLOCKED',
                actorType: 'SYSTEM',
                note: `Keputusan otomatis dicegah karena ada aturan yang membutuhkan persetujuan manual (${blockedReasons || 'Ketentuan khusus'}). Batas waktu diperpanjang ke ${dayjs(nextDeadline).format('D MMM YYYY HH:mm')} (perpanjangan ke-${currentBlockedCount + 1}/2).`,
                metadata: {
                  blocked_count: currentBlockedCount + 1,
                  reasons: blockedReasons,
                },
              })

              // Notifikasi Admin
              await queueNotification(
                {
                  eventType: 'APPROVAL_ESCALATED',
                  channel: 'EMAIL',
                  recipientAddress: 'admin@perusahaan.co.id',
                  subject: `[Perlu Tindakan Manual] Pengajuan #${r.request_number} Butuh Review`,
                  body: `Pengajuan #${r.request_number} (${r.requester_name}) melewati batas waktu namun dicegah disetujui otomatis karena memiliki aturan persetujuan manual: ${blockedReasons}`,
                  requestId: r.id,
                  dedupeKey: `blocked_admin:${r.id}:${currentBlockedCount + 1}`,
                  payload: { requestId: r.id, requestNumber: r.request_number },
                },
                tx
              )
              return
            }

            // Kasus B: Tidak lolos aturan dan autoDecisionRequiresRulePass = true -> REJECTED
            let finalStatus: 'APPROVED' | 'REJECTED'
            let finalReason = ''

            if (autoDecisionRequiresRulePass && !hasil.passed) {
              finalStatus = 'REJECTED'
              const failedMsgs = [
                ...hasil.autoRejectMessages,
                ...hasil.blockingMessages,
                ...hasil.details.filter((d) => !d.passed).map((d) => d.message),
              ].filter(Boolean)

              const violatedRules = failedMsgs.length > 0 ? failedMsgs.join('; ') : 'Ketentuan kebijakan tidak terpenuhi.'
              const template =
                policy.autoRejectReasonTemplate ||
                'Pengajuan ditolak otomatis oleh sistem karena melewati batas waktu {{deadline_hours}} jam dan tidak memenuhi ketentuan: {{violated_rules}}'

              finalReason = template
                .replace(/\{\{deadline_hours\}\}/g, String(overallHours))
                .replace(/\{\{violated_rules\}\}/g, violatedRules)
            } else {
              // Kasus C: Lolos aturan atau tidak mewajibkan -> ikuti onDeadlineAction (AUTO_APPROVE / AUTO_REJECT)
              if (onDeadlineAction === 'AUTO_REJECT') {
                finalStatus = 'REJECTED'
                finalReason = `Ditolak otomatis oleh sistem karena melewati batas waktu ${overallHours} jam.`
              } else {
                finalStatus = 'APPROVED'
                const template =
                  policy.autoApproveReasonTemplate ||
                  'Disetujui otomatis oleh sistem karena melewati batas waktu {{deadline_hours}} jam tanpa tindakan approver, dan seluruh ketentuan {{leave_type_name}} terpenuhi.'

                finalReason = template
                  .replace(/\{\{deadline_hours\}\}/g, String(overallHours))
                  .replace(/\{\{leave_type_name\}\}/g, r.leave_type_name)
              }
            }

            // 6. Selesaikan pengajuan
            await finalizeRequest(tx, r.id, finalStatus, 'SYSTEM_AUTO', finalReason)

            // 7. Antre notifikasi untuk pemohon dan approver
            if (finalStatus === 'APPROVED') {
              // Ke pemohon
              await queueNotification(
                {
                  eventType: 'REQUEST_AUTO_APPROVED',
                  channel: 'EMAIL',
                  recipientEmployeeId: r.employee_id,
                  recipientAddress: r.requester_email || r.employee_id,
                  subject: `[Disetujui Otomatis] Pengajuan Izin #${r.request_number}`,
                  body: `Halo ${r.requester_name},\n\nPengajuan izin #${r.request_number} (${r.leave_type_name}) telah disetujui otomatis oleh sistem.\n\nAlasan:\n${finalReason}`,
                  requestId: r.id,
                  dedupeKey: `auto_decision:${r.id}:REQUEST_AUTO_APPROVED`,
                  payload: { requestId: r.id, requestNumber: r.request_number, reason: finalReason },
                },
                tx
              )
            } else {
              // Ke pemohon
              await queueNotification(
                {
                  eventType: 'REQUEST_AUTO_REJECTED',
                  channel: 'EMAIL',
                  recipientEmployeeId: r.employee_id,
                  recipientAddress: r.requester_email || r.employee_id,
                  subject: `[Ditolak Otomatis] Pengajuan Izin #${r.request_number}`,
                  body: `Halo ${r.requester_name},\n\nPengajuan izin #${r.request_number} (${r.leave_type_name}) ditolak otomatis oleh sistem.\n\nAlasan:\n${finalReason}`,
                  requestId: r.id,
                  dedupeKey: `auto_decision:${r.id}:REQUEST_AUTO_REJECTED`,
                  payload: { requestId: r.id, requestNumber: r.request_number, reason: finalReason },
                },
                tx
              )
            }

            // Ke approver yang terlibat
            const approvers = (await tx.execute(sql`
              SELECT DISTINCT a.employee_id, e.email, e.full_name
              FROM approval_task_assignees a
              JOIN approval_tasks t ON t.id = a.task_id
              JOIN employees e ON e.id = a.employee_id
              WHERE t.request_id = ${r.id}::uuid
            `)) as any[]

            for (const app of approvers) {
              await queueNotification(
                {
                  eventType: finalStatus === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
                  channel: 'EMAIL',
                  recipientEmployeeId: app.employee_id,
                  recipientAddress: app.email || app.employee_id,
                  subject: `[${finalStatus === 'APPROVED' ? 'Disetujui' : 'Ditolak'} Otomatis] Pengajuan Izin #${r.request_number}`,
                  body: `Halo ${app.full_name},\n\nPengajuan izin #${r.request_number} (${r.requester_name}) telah diputuskan ${finalStatus === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK'} otomatis oleh sistem.\nAlasan: ${finalReason}`,
                  requestId: r.id,
                  dedupeKey: `auto_decision:${r.id}:approver:${app.employee_id}:${finalStatus}`,
                  payload: { requestId: r.id, requestNumber: r.request_number, approverId: app.employee_id },
                },
                tx
              )
            }
          })

          processedCount++
        } catch (itemErr: any) {
          console.error(`Gagal memproses auto-decision pengajuan ${r.id}:`, itemErr)
        }
      }

      return { processedCount }
    })
  },
})
