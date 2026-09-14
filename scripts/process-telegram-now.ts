import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not found')
    process.exit(1)
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`)
    const data = await res.json()
    console.log('GetUpdates status:', data.ok, 'Count:', data.result?.length)

    if (data.ok && Array.isArray(data.result)) {
      let maxUpdateId = 0
      for (const update of data.result) {
        maxUpdateId = Math.max(maxUpdateId, update.update_id)
        const msg = update.message
        if (!msg || !msg.text) continue

        const chatId = String(msg.chat.id)
        const text = msg.text.trim()
        console.log(`Processing update ${update.update_id}: from ${msg.from?.first_name} (chatId: ${chatId}) text: ${text}`)

        if (text.startsWith('/start')) {
          const parts = text.split(/\s+/)
          const linkingToken = parts[1]?.trim()
          console.log(`Linking token: ${linkingToken}`)

          // Link to user admin
          const users = await sql`SELECT id, username FROM auth.users WHERE username = 'admin' LIMIT 1`
          if (users.length > 0) {
            const adminUser = users[0]
            await sql`
              UPDATE auth.users
              SET telegram_chat_id = ${chatId},
                  telegram_username = ${msg.from?.username || null},
                  updated_at = NOW()
              WHERE id = ${adminUser.id}
            `
            console.log(`Successfully linked chatId ${chatId} to user ${adminUser.username}!`)

            // Send confirmation reply
            const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `✅ <b>Berhasil Terhubung!</b>\n\nAkun Telegram Anda (@${msg.from?.username || msg.from?.first_name}) kini resmi ditautkan ke <b>Sistem Perizinan Pegawai</b> untuk akun <b>${adminUser.username}</b>.\n\nAnda akan menerima notifikasi tugas persetujuan (approval), pengingat SLA, dan status pengajuan izin langsung di sini.\n\nKetik <code>/putuskan</code> jika ingin memutus sambungan.`,
                parse_mode: 'HTML',
              }),
            })
            const sendJson = await sendRes.json()
            console.log('SendMessage result:', sendJson.ok)
          }
        }
      }

      // Mark updates as consumed by sending offset = maxUpdateId + 1
      if (maxUpdateId > 0) {
        await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${maxUpdateId + 1}`)
        console.log(`Offset advanced to ${maxUpdateId + 1}`)
      }
    }
  } finally {
    await sql.end({ timeout: 1 })
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Error in script:', err)
  process.exit(1)
})
