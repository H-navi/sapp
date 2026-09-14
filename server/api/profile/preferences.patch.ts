import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  if (!auth.employeeId) {
    throw createError({ statusCode: 400, message: 'Profil pegawai tidak ditemukan.' })
  }

  const body = await readBody(event)
  const {
    emailEnabled,
    telegramEnabled,
    tasksEnabled,
    remindersEnabled,
    quietHoursStart,
    quietHoursEnd,
  } = body || {}

  const db = useDatabase()
  const empId = auth.employeeId

  const qStart = quietHoursStart?.trim() ? quietHoursStart : null
  const qEnd = quietHoursEnd?.trim() ? quietHoursEnd : null

  // 1. Simpan preferensi kanal EMAIL
  if (emailEnabled !== undefined) {
    await db.execute(sql`
      INSERT INTO notifications.notification_preferences (
        employee_id, channel, event_type, is_enabled, quiet_hours_start, quiet_hours_end, updated_at
      ) VALUES (
        ${empId}::uuid, 'EMAIL'::notification_channel_enum, NULL, ${emailEnabled}, ${qStart}, ${qEnd}, NOW()
      )
      ON CONFLICT (employee_id, channel) DO UPDATE
      SET is_enabled = EXCLUDED.is_enabled,
          quiet_hours_start = EXCLUDED.quiet_hours_start,
          quiet_hours_end = EXCLUDED.quiet_hours_end,
          updated_at = NOW()
    `)
  }

  // 2. Simpan preferensi kanal TELEGRAM
  if (telegramEnabled !== undefined) {
    await db.execute(sql`
      INSERT INTO notifications.notification_preferences (
        employee_id, channel, event_type, is_enabled, quiet_hours_start, quiet_hours_end, updated_at
      ) VALUES (
        ${empId}::uuid, 'TELEGRAM'::notification_channel_enum, NULL, ${telegramEnabled}, ${qStart}, ${qEnd}, NOW()
      )
      ON CONFLICT (employee_id, channel) DO UPDATE
      SET is_enabled = EXCLUDED.is_enabled,
          quiet_hours_start = EXCLUDED.quiet_hours_start,
          quiet_hours_end = EXCLUDED.quiet_hours_end,
          updated_at = NOW()
    `)
  }

  return {
    success: true,
    message: 'Preferensi notifikasi berhasil disimpan.',
  }
})
