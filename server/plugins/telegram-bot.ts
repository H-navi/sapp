import dotenv from 'dotenv'
import { handleTelegramUpdate } from '../utils/telegram-bot-handler'

// State global agar tidak terjadi duplikasi polling saat Nuxt HMR
const getPollingState = () => {
  const g = globalThis as any
  if (!g.__telegramBotState) {
    g.__telegramBotState = {
      isPollingActive: false,
      lastUpdateId: 0,
      isFetching: false,
    }
  }
  return g.__telegramBotState
}

export async function processTelegramUpdates(): Promise<number> {
  const state = getPollingState()
  if (state.isFetching) return 0
  state.isFetching = true

  try {
    try {
      dotenv.config({ override: true })
    } catch {}

    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    if (!token) return 0

    const query: Record<string, any> = {
      timeout: 5,
    }
    if (state.lastUpdateId > 0) {
      query.offset = state.lastUpdateId + 1
    }

    const res = await $fetch<{ ok: boolean; result: any[] }>(
      `https://api.telegram.org/bot${token}/getUpdates`,
      {
        query,
        timeout: 10000,
      }
    )

    let processed = 0
    if (res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        state.lastUpdateId = Math.max(state.lastUpdateId, update.update_id)
        try {
          await handleTelegramUpdate(update)
          processed++
        } catch (handleErr) {
          console.error('Error saat memproses update Telegram:', handleErr)
        }
      }
    }
    return processed
  } catch (err: any) {
    return 0
  } finally {
    state.isFetching = false
  }
}

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  const state = getPollingState()
  if (state.isPollingActive) {
    return
  }
  state.isPollingActive = true

  async function poll() {
    while (true) {
      try {
        await processTelegramUpdates()
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }

  poll().catch(() => {
    state.isPollingActive = false
  })
})
