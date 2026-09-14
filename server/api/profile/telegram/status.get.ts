import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  if (!auth.employeeId) {
    return { isLinked: false, chatId: null }
  }

  const db = useDatabase()
  const rows = (await db.execute(sql`
    SELECT telegram_chat_id
    FROM org.employees
    WHERE id = ${auth.employeeId}::uuid
    LIMIT 1
  `)) as any[]

  const chatId = rows[0]?.telegram_chat_id || null
  return {
    isLinked: Boolean(chatId),
    chatId,
    botConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
  }
})
