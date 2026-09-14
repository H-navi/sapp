import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { runTaskWithLock } from '../_runner'
import { sendEmailNotification } from '../../services/notification/channels/email'
import { sendTelegramNotification } from '../../services/notification/channels/telegram'

export default defineTask({
  meta: {
    name: 'notification:dispatch',
    description: 'Mengirimkan notifikasi dalam antrean ke saluran Email dan Telegram',
  },
  async run() {
    return await runTaskWithLock('notification:dispatch', 8005, async (db) => {
      // 1. Ambil batch notifikasi yang siap dikirim
      const pendingNotifications = (await db.execute(sql`
        SELECT id,
               channel,
               recipient_address AS "recipientAddress",
               recipient_employee_id AS "recipientEmployeeId",
               subject,
               body,
               attempt_count AS "attemptCount",
               max_attempts AS "maxAttempts",
               payload
        FROM notifications.notifications
        WHERE status IN ('QUEUED', 'FAILED')
          AND attempt_count < max_attempts
          AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `)) as any[]

      if (pendingNotifications.length === 0) {
        return { processedCount: 0 }
      }

      let successCount = 0
      let failedCount = 0

      // Batasi konkurensi maksimal 5 pengiriman sekaligus
      const CONCURRENCY_LIMIT = 5
      for (let i = 0; i < pendingNotifications.length; i += CONCURRENCY_LIMIT) {
        const batch = pendingNotifications.slice(i, i + CONCURRENCY_LIMIT)

        await Promise.all(
          batch.map(async (item) => {
            const notifId = item.id
            const attempt = Number(item.attemptCount) + 1
            const maxAttempts = Number(item.maxAttempts)

            // Tandai status SENDING
            await db.execute(sql`
              UPDATE notifications.notifications
              SET status = 'SENDING', updated_at = NOW()
              WHERE id = ${notifId}::uuid
            `)

            try {
              let sendRes: { success: boolean; messageId: string; error?: string; isPermanentError?: boolean; retryAfterSeconds?: number }

              if (item.channel === 'EMAIL') {
                sendRes = await sendEmailNotification({
                  to: item.recipientAddress,
                  subject: item.subject || 'Pemberitahuan Sistem Perizinan Pegawai',
                  bodyHtml: item.body,
                  actionUrl: item.payload?.actionUrl,
                })
              } else if (item.channel === 'TELEGRAM') {
                sendRes = await sendTelegramNotification({
                  chatId: item.recipientAddress,
                  text: item.body,
                  parseMode: item.payload?.parseMode ?? 'HTML',
                })
              } else {
                // In-App channel selesai otomatis
                sendRes = { success: true, messageId: `in-app-${notifId}` }
              }

              if (sendRes.success) {
                // Pengiriman berhasil -> SENT
                await db.execute(sql`
                  UPDATE notifications.notifications
                  SET status = 'SENT',
                      sent_at = NOW(),
                      provider_message_id = ${sendRes.messageId},
                      error_message = NULL,
                      updated_at = NOW()
                  WHERE id = ${notifId}::uuid
                `)
                successCount++
              } else {
                // Pengiriman gagal
                failedCount++
                const errorMessage = sendRes.error || 'Gagal mengirim pesan'

                if (sendRes.isPermanentError) {
                  // Galat permanen (bot diblokir atau chat ID tidak ada):
                  // Kosongkan telegram_chat_id pegawai agar tidak dicoba lagi di masa mendatang
                  if (item.channel === 'TELEGRAM' && item.recipientEmployeeId) {
                    await db.execute(sql`
                      UPDATE org.employees
                      SET telegram_chat_id = NULL, updated_at = NOW()
                      WHERE id = ${item.recipientEmployeeId}::uuid
                    `)
                  }

                  // Hentikan percobaan ulang untuk notifikasi ini
                  await db.execute(sql`
                    UPDATE notifications.notifications
                    SET status = 'FAILED',
                        failed_at = NOW(),
                        attempt_count = ${maxAttempts},
                        error_message = ${`[Permanen] ${errorMessage}`},
                        updated_at = NOW()
                    WHERE id = ${notifId}::uuid
                  `)
                } else {
                  // Galat sementara -> hitung jadwal backoff berikutnya
                  // Percobaan 1: +2 menit, Percobaan 2: +10 menit, Percobaan 3: +30 menit
                  let backoffMinutes = 2
                  if (attempt === 2) backoffMinutes = 10
                  else if (attempt >= 3) backoffMinutes = 30

                  let nextScheduled: Date
                  if (sendRes.retryAfterSeconds) {
                    nextScheduled = dayjs().add(sendRes.retryAfterSeconds, 'second').toDate()
                  } else {
                    nextScheduled = dayjs().add(backoffMinutes, 'minute').toDate()
                  }

                  await db.execute(sql`
                    UPDATE notifications.notifications
                    SET status = 'FAILED',
                        failed_at = NOW(),
                        attempt_count = ${attempt},
                        scheduled_at = ${nextScheduled.toISOString()}::timestamptz,
                        error_message = ${errorMessage},
                        updated_at = NOW()
                    WHERE id = ${notifId}::uuid
                  `)
                }
              }
            } catch (dispatchErr: any) {
              failedCount++
              const errStr = dispatchErr?.message || String(dispatchErr)
              const nextScheduled = dayjs().add(5, 'minute').toDate()

              await db.execute(sql`
                UPDATE notifications.notifications
                SET status = 'FAILED',
                    failed_at = NOW(),
                    attempt_count = ${attempt},
                    scheduled_at = ${nextScheduled.toISOString()}::timestamptz,
                    error_message = ${errStr},
                    updated_at = NOW()
                WHERE id = ${notifId}::uuid
              `)
            }
          })
        )
      }

      return {
        processedCount: pendingNotifications.length,
        details: {
          successCount,
          failedCount,
        },
      }
    })
  },
})
