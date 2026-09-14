import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  if (!auth.employeeId) {
    throw createError({ statusCode: 400, message: 'Profil pegawai tidak ditemukan.' })
  }

  const db = useDatabase()
  await db.execute(sql`
    UPDATE org.employees
    SET telegram_chat_id = NULL, updated_at = NOW()
    WHERE id = ${auth.employeeId}::uuid
  `)

  return {
    success: true,
    message: 'Akun Telegram berhasil diputuskan.',
  }
})
