import { handleTelegramUpdate } from '~~/server/utils/telegram-bot-handler'

export default defineEventHandler(async (event) => {
  const secretHeader = getHeader(event, 'x-telegram-bot-api-secret-token')
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (expectedSecret && secretHeader !== expectedSecret) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  if (body) {
    await handleTelegramUpdate(body)
  }

  return { ok: true }
})
