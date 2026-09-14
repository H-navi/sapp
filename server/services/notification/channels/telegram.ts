export interface SendTelegramInput {
  chatId: string | number
  text: string
  parseMode?: 'HTML' | 'Markdown'
  disablePreview?: boolean
}

export interface SendTelegramResult {
  success: boolean
  messageId: string
  simulated?: boolean
  isPermanentError?: boolean
  retryAfterSeconds?: number
  error?: string
}

/**
 * Melakukan sanitasi karakter HTML khusus agar aman disisipkan ke Telegram parse_mode='HTML'.
 */
export function escapeTelegramHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

import dotenv from 'dotenv'

export async function sendTelegramNotification(input: SendTelegramInput): Promise<SendTelegramResult> {
  try {
    dotenv.config({ override: true })
  } catch {}

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || ''

  if (!token) {
    // Mode Simulasi (dev / tanpa token bot)
    const simulatedId = `sim-tg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    console.info(`[TELEGRAM SIMULASI] Chat ID: ${input.chatId} | ID: ${simulatedId}\n${input.text}`)
    return {
      success: true,
      messageId: simulatedId,
      simulated: true,
    }
  }

  try {
    const res = await $fetch<{ ok: boolean; result: { message_id: number } }>(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        body: {
          chat_id: input.chatId,
          text: input.text,
          parse_mode: input.parseMode ?? 'HTML',
          disable_web_page_preview: input.disablePreview ?? true,
        },
      }
    )

    return {
      success: true,
      messageId: String(res.result?.message_id ?? Date.now()),
    }
  } catch (err: any) {
    const statusCode = err?.statusCode || err?.response?.status || 500
    const errData = err?.data || err?.response?._data || {}
    const desc = (errData?.description || err?.message || String(err)).toLowerCase()

    // 1. Bot diblokir oleh pengguna
    if (statusCode === 403 || desc.includes('bot was blocked') || desc.includes('user is deactivated')) {
      return {
        success: false,
        messageId: '',
        isPermanentError: true,
        error: 'BOT_BLOCKED',
      }
    }

    // 2. Chat ID tidak ditemukan
    if (statusCode === 400 && (desc.includes('chat not found') || desc.includes('chat_id is empty'))) {
      return {
        success: false,
        messageId: '',
        isPermanentError: true,
        error: 'CHAT_NOT_FOUND',
      }
    }

    // 3. Batas laju pesan Telegram (Rate Limit 429)
    if (statusCode === 429) {
      const retryAfter = Number(errData?.parameters?.retry_after ?? 60)
      return {
        success: false,
        messageId: '',
        isPermanentError: false,
        retryAfterSeconds: retryAfter,
        error: `RATE_LIMIT_${retryAfter}S`,
      }
    }

    return {
      success: false,
      messageId: '',
      isPermanentError: false,
      error: desc,
    }
  }
}
