import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = useDatabase()

  const rows = (await db.execute(sql`
    SELECT COALESCE(e.telegram_chat_id, u.telegram_chat_id) AS telegram_chat_id
    FROM auth.users u
    LEFT JOIN org.employees e ON e.id = u.employee_id
    WHERE u.id = ${auth.userId}::uuid
    LIMIT 1
  `)) as any[]

  const chatId = rows[0]?.telegram_chat_id || null
  return {
    isLinked: Boolean(chatId),
    chatId,
    botConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
  }
})
