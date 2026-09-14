import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import { sendEmailNotification } from '~~/server/services/notification/channels/email'

import dotenv from 'dotenv'

export default defineEventHandler(async (event) => {
  try {
    dotenv.config({ override: true })
  } catch {}

  const auth = requireAuth(event)
  const body = await readBody(event).catch(() => ({}))
  const db = useDatabase()

  // Ambil email tujuan
  const userRows = (await db.execute(sql`
    SELECT u.email AS user_email, e.email AS employee_email, COALESCE(e.full_name, u.username) AS full_name
    FROM auth.users u
    LEFT JOIN org.employees e ON e.id = u.employee_id
    WHERE u.id = ${auth.userId}::uuid
    LIMIT 1
  `)) as any[]

  if (userRows.length === 0) {
    throw createError({ statusCode: 404, message: 'Data pengguna tidak ditemukan.' })
  }

  const u = userRows[0]
  let targetEmail = body?.email?.trim() || u.employee_email || u.user_email

  // Jika email akun masih berupa placeholder (@perusahaan.co.id) dan ada SMTP_USER asli di .env,
  // utamakan pengiriman ke SMTP_USER agar pengguna menerima email di kotak masuk aslinya
  if ((!targetEmail || targetEmail.endsWith('@perusahaan.co.id')) && process.env.SMTP_USER) {
    targetEmail = process.env.SMTP_USER.trim()
  }

  if (!targetEmail) {
    throw createError({
      statusCode: 400,
      message: 'Tidak ditemukan alamat email penerima. Pastikan akun Anda memiliki alamat email.',
    })
  }

  try {
    const res = await sendEmailNotification({
      to: targetEmail,
      subject: '[Uji Coba] Notifikasi Email Sistem Perizinan Pegawai',
      bodyHtml: `Halo <b>${u.full_name}</b>,\n\nIni adalah pesan email uji coba dari <b>Sistem Perizinan Pegawai</b>.\n\nKonfigurasi SMTP server dan template email HTML Anda telah terverifikasi dan berhasil mengirim pesan secara normal.\n\nWaktu pengujian: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
      actionUrl: process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      actionText: 'Buka Dashboard Aplikasi',
    })

    return {
      success: true,
      simulated: res.simulated,
      messageId: res.messageId,
      to: targetEmail,
      message: res.simulated
        ? `[Mode Simulasi] Email uji berhasil dicatat untuk ${targetEmail} (Kredensial SMTP belum lengkap).`
        : `Email uji berhasil dikirim ke ${targetEmail}. Silakan periksa kotak masuk atau folder spam Anda!`,
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err)
    if (errMsg.includes('535') || errMsg.includes('Username and Password not accepted')) {
      throw createError({
        statusCode: 500,
        message: 'Gagal autentikasi Gmail SMTP. Pastikan menggunakan 16 karakter App Password dari Google Account Security, bukan password utama.',
      })
    }
    throw createError({
      statusCode: 500,
      message: `Gagal mengirim email: ${errMsg}`,
    })
  }
})
