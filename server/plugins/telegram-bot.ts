import { handleTelegramUpdate } from '../utils/telegram-bot-handler'

export default defineNitroPlugin(() => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    return
  }

  // Hanya jalankan long-polling otomatis saat mode development / non-production
  if (process.env.NODE_ENV === 'production') {
    return
  }

  let lastUpdateId = 0
  let isPolling = true

  async function poll() {
    while (isPolling) {
      try {
        const res = await $fetch<{ ok: boolean; result: any[] }>(
          `https://api.telegram.org/bot${token}/getUpdates`,
          {
            query: {
              offset: lastUpdateId + 1,
              timeout: 10,
            },
            timeout: 15000,
          }
        )

        if (res.ok && Array.isArray(res.result)) {
          for (const update of res.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id)
            try {
              await handleTelegramUpdate(update)
            } catch (handleErr) {
              console.error('Error saat memproses update Telegram:', handleErr)
            }
          }
        }
      } catch (err: any) {
        // Jika bot token tidak valid atau koneksi putus, beri jeda sebelum coba lagi
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  // Mulai polling di latar belakang
  poll().catch(() => {})
})
