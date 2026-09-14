import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { verifyTelegramLinkingToken } from './telegram-linking'
import { sendTelegramNotification, escapeTelegramHtml } from '../services/notification/channels/telegram'

/**
 * Memproses update masuk dari Telegram (pesan / perintah dari pengguna).
 */
export async function handleTelegramUpdate(update: any) {
  const message = update?.message
  if (!message || !message.text) return

  const chatId = String(message.chat.id)
  const text = message.text.trim()
  const db = useDatabase()

  // 1. Perintah /start <token>
  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/)
    const token = parts[1]?.trim()

    if (!token) {
      await sendTelegramNotification({
        chatId,
        text: `Halo ${escapeTelegramHtml(message.from?.first_name || 'Rekan')}! 👋\n\nIni adalah bot resmi <b>Sistem Perizinan Pegawai</b>.\n\nUntuk menautkan akun Anda, silakan buka menu <b>Profil</b> di aplikasi web dan klik tombol <b>Hubungkan Telegram</b>.`,
      })
      return
    }

    const employeeId = verifyTelegramLinkingToken(token)
    if (!employeeId) {
      await sendTelegramNotification({
        chatId,
        text: `❌ <b>Tautan Tidak Valid atau Kadaluarsa</b>\n\nToken penautan sudah melewati batas waktu 15 menit atau telah digunakan. Silakan klik tombol <b>Hubungkan Telegram</b> kembali pada halaman Profil aplikasi.`,
      })
      return
    }

    // Simpan telegram_chat_id ke tabel employees
    await db.execute(sql`
      UPDATE org.employees
      SET telegram_chat_id = ${chatId}, updated_at = NOW()
      WHERE id = ${employeeId}::uuid
    `)

    await sendTelegramNotification({
      chatId,
      text: `✅ <b>Berhasil Terhubung!</b>\n\nAkun Telegram Anda kini resmi ditautkan ke Sistem Perizinan Pegawai.\n\nAnda akan menerima notifikasi tugas persetujuan (approval), pengingat SLA, dan status pengajuan izin langsung di sini.\n\nKetik <code>/putuskan</code> jika ingin memutus sambungan.`,
    })
    return
  }

  // 2. Perintah /putuskan
  if (text === '/putuskan') {
    await db.execute(sql`
      UPDATE org.employees
      SET telegram_chat_id = NULL, updated_at = NOW()
      WHERE telegram_chat_id = ${chatId}
    `)

    await sendTelegramNotification({
      chatId,
      text: `ℹ️ <b>Sambungan Diputuskan</b>\n\nAkun Telegram Anda telah dilepas dari Sistem Perizinan Pegawai. Notifikasi tidak akan dikirimkan ke sini lagi sampai ditautkan kembali.`,
    })
    return
  }

  // 3. Pesan umum / bantuan
  await sendTelegramNotification({
    chatId,
    text: `Halo! Ini adalah notifikasi satu arah Sistem Perizinan Pegawai.\n\nBuka menu <b>Profil</b> di aplikasi untuk mengelola preferensi notifikasi Anda.`,
  })
}
