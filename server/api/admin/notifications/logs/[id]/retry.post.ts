import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.template.manage')
  const id = getRouterParam(event, 'id')
  const db = useDatabase()

  const existing = (await db.execute(sql`
    SELECT id, status, recipient_address, channel
    FROM notifications.notifications
    WHERE id = ${id}::uuid
    LIMIT 1
  `)) as any[]

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: 'Notifikasi tidak ditemukan.' })
  }

  const notif = existing[0]

  const updated = (await db.execute(sql`
    UPDATE notifications.notifications
    SET
      status = 'QUEUED',
      attempt_count = 0,
      scheduled_at = now(),
      error_message = NULL,
      failed_at = NULL
    WHERE id = ${id}::uuid
    RETURNING id, status, scheduled_at, recipient_address
  `)) as any[]

  return {
    success: true,
    message: `Notifikasi untuk ${notif.recipient_address} telah dimasukkan kembali ke antrean pengiriman.`,
    data: updated[0],
  }
})
