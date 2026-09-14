import { requireAuth } from '~~/server/utils/guard'
import { createTelegramLinkingToken } from '~~/server/utils/telegram-linking'

let cachedBotUsername: string | null = null

async function getBotUsername(token: string): Promise<string> {
  if (cachedBotUsername) return cachedBotUsername
  try {
    const res = await $fetch<{ ok: boolean; result: { username: string } }>(
      `https://api.telegram.org/bot${token}/getMe`
    )
    if (res.ok && res.result?.username) {
      cachedBotUsername = res.result.username
      return cachedBotUsername
    }
  } catch (err) {
    console.warn('Gagal memanggil getMe Telegram:', err)
  }
  return process.env.TELEGRAM_BOT_USERNAME || 'PerizinanPegawaiBot'
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  if (!auth.employeeId) {
    throw createError({ statusCode: 400, message: 'Akun Anda tidak terikat dengan profil pegawai.' })
  }

  const tokenStr = process.env.TELEGRAM_BOT_TOKEN?.trim() || ''
  const botUsername = tokenStr ? await getBotUsername(tokenStr) : (process.env.TELEGRAM_BOT_USERNAME || 'PerizinanPegawaiBot')

  const linkingToken = createTelegramLinkingToken(auth.employeeId)
  const deepLink = `https://t.me/${botUsername}?start=${linkingToken}`

  return {
    success: true,
    token: linkingToken,
    botUsername,
    deepLink,
    isBotConfigured: Boolean(tokenStr),
    expiresInMinutes: 15,
  }
})
