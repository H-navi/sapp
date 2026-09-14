import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import { renderNotificationTemplate } from '~~/server/services/notification/renderer'
import { sendEmailNotification } from '~~/server/services/notification/channels/email'
import { sendTelegramNotification } from '~~/server/services/notification/channels/telegram'

const MOCK_VARS: Record<string, string> = {
  employee_name: 'Budi Santoso',
  employee_nip: '198507122010121001',
  department_name: 'Divisi Teknologi Informasi',
  leave_type_name: 'Cuti Tahunan',
  request_number: 'REQ-TEST-9999',
  start_date: 'Senin, 20 Oktober 2026',
  end_date: 'Rabu, 22 Oktober 2026',
  total_days: '3 hari',
  reason: 'Uji coba pengiriman template notifikasi admin',
  approver_name: 'Admin Penilai',
  step_name: 'Verifikasi Administrator',
  step_order: '1',
  due_at: 'Besok, 17:00 WIB',
  remaining_time: '24 jam kerja',
  reminder_count: '1',
  action_url: 'http://localhost:3000/admin/notifikasi',
  decision: 'DISETUJUI',
  decision_reason: 'Pengujian berhasil dilakukan dari dasbor admin.',
  decided_by: 'Administrator Sistem',
  quota_balance: '12',
  app_name: 'Sistem Perizinan Pegawai',
}

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.template.manage')
  const body = await readBody(event)
  const db = useDatabase()

  const {
    subject_template = 'Uji Coba Notifikasi',
    body_template = '',
    channel = 'EMAIL',
  } = body || {}

  if (!body_template) {
    throw createError({ statusCode: 400, message: 'Isi template tidak boleh kosong.' })
  }

  // Ambil profil admin
  const userRows = (await db.execute(sql`
    SELECT u.id, u.email AS user_email, e.id AS employee_id, COALESCE(e.full_name, u.username) AS full_name,
           e.email AS employee_email, COALESCE(e.telegram_chat_id, u.telegram_chat_id) AS telegram_chat_id
    FROM auth.users u
    LEFT JOIN org.employees e ON e.id = u.employee_id
    WHERE u.id = ${auth.userId}::uuid
    LIMIT 1
  `)) as any[]

  if (userRows.length === 0) {
    throw createError({ statusCode: 404, message: 'Pengguna tidak ditemukan.' })
  }

  const user = userRows[0]
  let targetEmail = user.employee_email || user.user_email
  if ((!targetEmail || targetEmail.endsWith('@perusahaan.co.id')) && process.env.SMTP_USER) {
    targetEmail = process.env.SMTP_USER.trim()
  }

  const mockContext = {
    ...MOCK_VARS,
    approver_name: user.full_name || 'Admin',
    employee_name: user.full_name || 'Admin',
  }

  if (channel === 'EMAIL') {
    if (!targetEmail) {
      throw createError({ statusCode: 400, message: 'Akun Anda tidak memiliki alamat email terdaftar.' })
    }

    const renderedSubj = renderNotificationTemplate(subject_template, mockContext, 'EMAIL')
    const renderedBody = renderNotificationTemplate(body_template, mockContext, 'EMAIL')

    const res = await sendEmailNotification({
      to: targetEmail,
      subject: `[UJI NOTIFIKASI] ${renderedSubj}`,
      bodyHtml: renderedBody,
      actionUrl: mockContext.action_url,
      actionText: 'Buka Admin Notifikasi',
    })

    return {
      success: true,
      channel: 'EMAIL',
      target: targetEmail,
      simulated: res.simulated,
      messageId: res.messageId,
      message: res.simulated
        ? `[Mode Simulasi] Email uji berhasil dicatat untuk ${targetEmail} (SMTP belum disetel di .env).`
        : `Email uji berhasil dikirim ke ${targetEmail}.`,
    }
  } else if (channel === 'TELEGRAM') {
    if (!user.telegram_chat_id) {
      throw createError({
        statusCode: 400,
        message: 'Akun Telegram Anda belum ditautkan. Buka halaman Profil dan klik "Hubungkan Telegram" terlebih dahulu sebelum melakukan uji kirim.',
      })
    }

    const renderedBody = renderNotificationTemplate(body_template, mockContext, 'TELEGRAM')
    const fullText = `<b>[UJI COBA NOTIFIKASI]</b>\n\n${renderedBody}`

    const res = await sendTelegramNotification({
      chatId: user.telegram_chat_id,
      text: fullText,
    })

    if (!res.success) {
      throw createError({
        statusCode: 500,
        message: `Gagal mengirim Telegram uji: ${res.error || 'Terjadi kesalahan provider Telegram.'}`,
      })
    }

    return {
      success: true,
      channel: 'TELEGRAM',
      target: user.telegram_chat_id,
      simulated: res.simulated,
      messageId: res.messageId,
      message: res.simulated
        ? `[Mode Simulasi] Pesan Telegram berhasil dicatat untuk Chat ID ${user.telegram_chat_id} (TELEGRAM_BOT_TOKEN belum disetel di .env).`
        : `Pesan Telegram uji berhasil dikirim ke Chat ID ${user.telegram_chat_id}.`,
    }
  }

  throw createError({ statusCode: 400, message: 'Kanal tidak didukung.' })
})
