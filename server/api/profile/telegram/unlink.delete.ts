import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = useDatabase()

  // Unlink from auth.users
  await db.execute(sql`
    UPDATE auth.users
    SET telegram_chat_id = NULL, telegram_username = NULL, updated_at = NOW()
    WHERE id = ${auth.userId}::uuid
  `)

  // If user has employeeId, also unlink from org.employees
  if (auth.employeeId) {
    await db.execute(sql`
      UPDATE org.employees
      SET telegram_chat_id = NULL, telegram_username = NULL, updated_at = NOW()
      WHERE id = ${auth.employeeId}::uuid
    `)
  }

  return {
    success: true,
    message: 'Akun Telegram berhasil diputuskan.',
  }
})
