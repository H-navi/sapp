import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import { sendTelegramNotification } from '~~/server/services/notification/channels/telegram'

import dotenv from 'dotenv'

export default defineEventHandler(async (event) => {
  try {
    dotenv.config({ override: true })
  } catch {}

  const auth = requireAuth(event)
  const db = useDatabase()

  const rows = (await db.execute(sql`
    SELECT COALESCE(e.telegram_chat_id, u.telegram_chat_id) AS telegram_chat_id,
           COALESCE(e.full_name, u.username) AS full_name
    FROM auth.users u
    LEFT JOIN org.employees e ON e.id = u.employee_id
    WHERE u.id = ${auth.userId}::uuid
    LIMIT 1
  `)) as any[]

  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Data pengguna tidak ditemukan.' })
  }

  const u = rows[0]
  const chatId = u.telegram_chat_id

  if (!chatId) {
    throw createError({
      statusCode: 400,
      message: 'Akun Telegram Anda belum ditautkan. Silakan klik "Hubungkan Telegram" terlebih dahulu.',
    })
  }

  const res = await sendTelegramNotification({
    chatId,
    text: `🔔 <b>Uji Coba Notifikasi Telegram</b>\n\nHalo <b>${u.full_name}</b>!\n\nIni adalah pesan uji coba dari <b>Sistem Perizinan Pegawai</b>.\nPenautan bot Telegram Anda telah berhasil dan siap menerima pemberitahuan tugas persetujuan dan pengingat SLA.`,
  })

  if (!res.success) {
    throw createError({
      statusCode: 500,
      message: `Gagal mengirim pesan Telegram: ${res.error || 'Terjadi kesalahan provider Telegram.'}`,
    })
  }

  return {
    success: true,
    simulated: res.simulated,
    chatId,
    message: res.simulated
      ? `[Mode Simulasi] Pesan Telegram uji dicatat untuk Chat ID ${chatId}.`
      : `Pesan Telegram uji berhasil dikirim ke Chat ID ${chatId}! Silakan periksa obrolan Telegram Anda.`,
  }
})
