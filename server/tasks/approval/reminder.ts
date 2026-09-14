import { eq, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { runTaskWithLock } from '../_runner'
import * as schema from '../../database/schema'
import { loadWorkingCalendar, isWithinWorkingHours, nextWorkingMoment } from '../../utils/working-time'
import { queueNotification } from '../../services/notification/enqueue'

export default defineTask({
  meta: {
    name: 'approval:reminder',
    description: 'Kirim pengingat persetujuan berkala dalam jam kerja',
  },
  async run(customNow?: Date) {
    return await runTaskWithLock('approval:reminder', 8001, async (db) => {
      const cal = await loadWorkingCalendar()
      const now = customNow || new Date()

      // 1. Ambil tugas pending yang jadwal pengingatnya telah tiba
      const tasks = (await db.execute(sql`
        SELECT t.id,
               t.request_id,
               t.step_order,
               t.step_name,
               t.reminder_count,
               t.step_snapshot,
               r.request_number,
               e.full_name AS requester_name
        FROM approval_tasks t
        JOIN leave_requests r ON r.id = t.request_id
        JOIN employees e ON e.id = r.employee_id
        WHERE t.status = 'PENDING'
          AND t.next_reminder_at IS NOT NULL
          AND t.next_reminder_at <= NOW()
          AND r.status IN ('SUBMITTED', 'IN_REVIEW')
        ORDER BY t.next_reminder_at ASC
        LIMIT 200
        FOR UPDATE OF t SKIP LOCKED
      `)) as any[]

      let processedCount = 0

      for (const t of tasks) {
        try {
          const step = (t.step_snapshot || {}) as any
          const reminderEnabled = step.reminderEnabled ?? true
          const reminderMaxCount = Number(step.reminderMaxCount ?? 5)
          const reminderIntervalMinutes = Number(step.reminderIntervalMinutes ?? 120)
          const reminderOnlyWorkingHours = step.reminderOnlyWorkingHours ?? true
          const channels = Array.isArray(step.reminderChannels) && step.reminderChannels.length > 0
            ? step.reminderChannels
            : ['EMAIL']

          // Jika pengingat dimatikan
          if (!reminderEnabled) {
            await db
              .update(schema.approvalTasks)
              .set({ nextReminderAt: null, updatedAt: new Date() })
              .where(eq(schema.approvalTasks.id, t.id))
            continue
          }

          // Jika sudah mencapai batas maksimal pengingat
          if (Number(t.reminder_count) >= reminderMaxCount) {
            await db
              .update(schema.approvalTasks)
              .set({ nextReminderAt: null, updatedAt: new Date() })
              .where(eq(schema.approvalTasks.id, t.id))
            continue
          }

          // Jika di luar jam kerja dan diwajibkan hanya pada jam kerja:
          // Tunda ke awal jam kerja berikutnya TANPA menaikkan reminder_count!
          if (reminderOnlyWorkingHours && !isWithinWorkingHours(now, cal)) {
            const nextMoment = nextWorkingMoment(now, cal)
            await db
              .update(schema.approvalTasks)
              .set({ nextReminderAt: nextMoment, updatedAt: new Date() })
              .where(eq(schema.approvalTasks.id, t.id))
            continue
          }

          // 2. Ambil seluruh assignee yang belum merespons
          const assignees = (await db.execute(sql`
            SELECT a.id,
                   a.employee_id,
                   e.full_name,
                   e.email,
                   e.telegram_chat_id
            FROM approval_task_assignees a
            JOIN employees e ON e.id = a.employee_id
            WHERE a.task_id = ${t.id}::uuid
              AND a.response IS NULL
          `)) as any[]

          if (assignees.length === 0) {
            await db
              .update(schema.approvalTasks)
              .set({ nextReminderAt: null, updatedAt: new Date() })
              .where(eq(schema.approvalTasks.id, t.id))
            continue
          }

          const nextCount = Number(t.reminder_count) + 1
          const recipientsList: string[] = []

          // 3. Masukkan notifikasi ke antrean untuk tiap assignee dan kanal
          for (const a of assignees) {
            for (const ch of channels) {
              const channelType = ch as 'EMAIL' | 'TELEGRAM' | 'IN_APP'
              let recipientAddress = a.email || a.employee_id

              if (channelType === 'TELEGRAM') {
                if (!a.telegram_chat_id) continue // Lewati telegram jika belum ditautkan
                recipientAddress = a.telegram_chat_id
              } else if (channelType === 'IN_APP') {
                recipientAddress = a.employee_id
              }

              const dedupeKey = `reminder:${t.id}:${a.employee_id}:${channelType}:${nextCount}`
              const subject = `[Pengingat] Persetujuan Izin #${t.request_number} - ${t.requester_name}`
              const body = `Halo ${a.full_name},\n\nMohon segera menindaklanjuti tugas persetujuan izin pegawai ${t.requester_name} (#${t.request_number}) pada tahap ${t.step_name}.\n\nPengingat ke-${nextCount} dari maksimal ${reminderMaxCount}.`

              await queueNotification(
                {
                  eventType: 'APPROVAL_REMINDER',
                  channel: channelType,
                  recipientEmployeeId: a.employee_id,
                  recipientAddress,
                  subject,
                  body,
                  requestId: t.request_id,
                  taskId: t.id,
                  dedupeKey,
                  payload: {
                    reminderCount: nextCount,
                    maxReminderCount: reminderMaxCount,
                    stepName: t.step_name,
                    requesterName: t.requester_name,
                  },
                },
                db
              )

              recipientsList.push(a.full_name)
            }
          }

          // 4. Hitung waktu pengingat berikutnya
          let nextReminder = dayjs(now).add(reminderIntervalMinutes, 'minute').toDate()
          if (reminderOnlyWorkingHours && !isWithinWorkingHours(nextReminder, cal)) {
            nextReminder = nextWorkingMoment(nextReminder, cal)
          }

          // 5. Perbarui status approval_tasks
          await db
            .update(schema.approvalTasks)
            .set({
              reminderCount: nextCount,
              lastReminderAt: now,
              nextReminderAt: nextCount >= reminderMaxCount ? null : nextReminder,
              updatedAt: now,
            })
            .where(eq(schema.approvalTasks.id, t.id))

          // 6. Catat riwayat persetujuan
          await db.insert(schema.approvalHistories).values({
            requestId: t.request_id,
            taskId: t.id,
            stepOrder: t.step_order,
            stepName: t.step_name,
            action: 'REMINDER_SENT',
            actorType: 'SYSTEM',
            note: `Pengingat ke-${nextCount} telah dikirim ke ${assignees.length} approver.`,
            metadata: {
              reminder_count: nextCount,
              channels,
              recipients: recipientsList,
            },
          })

          processedCount++
        } catch (itemErr: any) {
          console.error(`Gagal memproses pengingat task ${t.id}:`, itemErr)
        }
      }

      return { processedCount }
    })
  },
})
