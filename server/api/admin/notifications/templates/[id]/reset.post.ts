import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

const FACTORY_DEFAULTS: Record<string, { subject: string | null; body: string }> = {
  TPL_TASK_ASSIGNED_EMAIL: {
    subject: '[{{app_name}}] Persetujuan dibutuhkan: {{leave_type_name}} - {{employee_name}}',
    body: `Halo {{approver_name}},\n\nAda pengajuan perizinan yang menunggu persetujuan Anda pada tahap "{{step_name}}".\n\nNomor    : {{request_number}}\nPemohon  : {{employee_name}} ({{department_name}})\nJenis    : {{leave_type_name}}\nTanggal  : {{start_date}} s/d {{end_date}} ({{total_days}} hari)\nAlasan   : {{reason}}\n\nBatas waktu tindakan: {{due_at}}\nJika tidak ada tindakan sampai batas waktu, sistem akan memproses pengajuan ini secara otomatis sesuai aturan yang berlaku.\n\nProses di sini: {{action_url}}`,
  },
  TPL_TASK_ASSIGNED_TG: {
    subject: null,
    body: `<b>🔔 Persetujuan Dibutuhkan</b>\n\n<b>{{leave_type_name}}</b>\nPemohon: {{employee_name}}\nTanggal: {{start_date}} - {{end_date}} ({{total_days}} hari)\nTahap: {{step_name}}\nBatas waktu: {{due_at}}\n\n<a href="{{action_url}}">Buka halaman approval</a>`,
  },
  TPL_REMINDER_EMAIL: {
    subject: '[Pengingat #{{reminder_count}}] {{request_number}} menunggu persetujuan Anda',
    body: `Halo {{approver_name}},\n\nPengajuan {{request_number}} atas nama {{employee_name}} masih menunggu persetujuan Anda.\n\nJenis   : {{leave_type_name}}\nTanggal : {{start_date}} s/d {{end_date}}\nSisa waktu: {{remaining_time}}\n\nBila batas waktu terlewati, sistem akan mengambil keputusan otomatis sesuai aturan.\n\nProses di sini: {{action_url}}`,
  },
  TPL_REMINDER_TG: {
    subject: null,
    body: `<b>⏰ Pengingat #{{reminder_count}}</b>\n\n{{request_number}} - {{employee_name}}\n{{leave_type_name}} | {{start_date}} - {{end_date}}\n\nSisa waktu: <b>{{remaining_time}}</b>\n<a href="{{action_url}}">Proses sekarang</a>`,
  },
  TPL_ESCALATED_EMAIL: {
    subject: '[Eskalasi] {{request_number}} dilanjutkan ke tahap berikutnya',
    body: `Pengajuan {{request_number}} ({{employee_name}}) telah melewati batas waktu pada tahap "{{step_name}}" dan dieskalasi secara otomatis.\n\nDetail: {{action_url}}`,
  },
  TPL_SUBMITTED_EMAIL: {
    subject: '[{{app_name}}] Pengajuan {{request_number}} terkirim',
    body: `Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda telah terkirim dan sedang diproses.\n\nNomor   : {{request_number}}\nTanggal : {{start_date}} s/d {{end_date}} ({{total_days}} hari)\nTahap saat ini: {{step_name}} ({{approver_name}})\n\nPantau status: {{action_url}}`,
  },
  TPL_STEP_APPROVED_TG: {
    subject: null,
    body: `✅ <b>Tahap {{step_order}} disetujui</b>\n\n{{request_number}} - {{leave_type_name}}\nDisetujui oleh: {{decided_by}} ({{step_name}})\n\nMenunggu tahap berikutnya.`,
  },
  TPL_APPROVED_EMAIL: {
    subject: '[{{app_name}}] Pengajuan {{request_number}} DISETUJUI',
    body: `Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda ({{start_date}} s/d {{end_date}}) telah DISETUJUI.\n\nDiputuskan oleh : {{decided_by}}\nKeterangan      : {{decision_reason}}\nSisa kuota      : {{quota_balance}} hari\n\nRiwayat lengkap: {{action_url}}`,
  },
  TPL_APPROVED_TG: {
    subject: null,
    body: `✅ <b>Pengajuan Disetujui</b>\n\n{{request_number}} - {{leave_type_name}}\n{{start_date}} s/d {{end_date}} ({{total_days}} hari)\nOleh: {{decided_by}}\n\n<a href="{{action_url}}">Lihat riwayat approval</a>`,
  },
  TPL_REJECTED_EMAIL: {
    subject: '[{{app_name}}] Pengajuan {{request_number}} DITOLAK',
    body: `Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda ({{start_date}} s/d {{end_date}}) DITOLAK.\n\nDiputuskan oleh : {{decided_by}}\nAlasan          : {{decision_reason}}\n\nRiwayat lengkap: {{action_url}}`,
  },
  TPL_REJECTED_TG: {
    subject: null,
    body: `❌ <b>Pengajuan Ditolak</b>\n\n{{request_number}} - {{leave_type_name}}\nAlasan: {{decision_reason}}\n\n<a href="{{action_url}}">Lihat detail</a>`,
  },
  TPL_AUTO_APPROVED_EMAIL: {
    subject: '[{{app_name}}] Pengajuan {{request_number}} disetujui otomatis',
    body: `Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda disetujui secara OTOMATIS oleh sistem.\n\nAlasan: {{decision_reason}}\nTanggal: {{start_date}} s/d {{end_date}} ({{total_days}} hari)\n\nRiwayat lengkap: {{action_url}}`,
  },
  TPL_AUTO_REJECTED_EMAIL: {
    subject: '[{{app_name}}] Pengajuan {{request_number}} ditolak otomatis',
    body: `Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda ditolak secara OTOMATIS oleh sistem karena tidak memenuhi ketentuan yang berlaku.\n\nAlasan: {{decision_reason}}\n\nRiwayat lengkap: {{action_url}}`,
  },
  TPL_ESCALATION_ADMIN_EMAIL: {
    subject: '[{{app_name}}] Eskalasi otomatis pada {{request_number}}',
    body: `Pengajuan {{request_number}} ({{employee_name}}) melewati SLA pada tahap "{{step_name}}" dan diproses otomatis oleh sistem.\n\nDetail: {{action_url}}`,
  },
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.template.manage')
  const id = getRouterParam(event, 'id')
  const db = useDatabase()

  const existing = (await db.execute(sql`
    SELECT id, code, event_type, channel, target_audience, is_default
    FROM notifications.notification_templates
    WHERE id = ${id}::uuid
    LIMIT 1
  `)) as any[]

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: 'Template notifikasi tidak ditemukan.' })
  }

  const tpl = existing[0]

  let newSubject: string | null = null
  let newBody = ''

  if (FACTORY_DEFAULTS[tpl.code]) {
    newSubject = FACTORY_DEFAULTS[tpl.code].subject
    newBody = FACTORY_DEFAULTS[tpl.code].body
  } else {
    // Cari template default dengan tuple (event_type, channel, target_audience)
    const defaultRow = (await db.execute(sql`
      SELECT subject_template, body_template
      FROM notifications.notification_templates
      WHERE event_type::text = ${tpl.event_type}::text
        AND channel::text = ${tpl.channel}::text
        AND target_audience = ${tpl.target_audience}
        AND is_default = true
      LIMIT 1
    `)) as any[]

    if (defaultRow.length > 0) {
      newSubject = defaultRow[0].subject_template
      newBody = defaultRow[0].body_template
    } else {
      throw createError({
        statusCode: 400,
        message: 'Tidak ditemukan template default acuan untuk mereset template ini.',
      })
    }
  }

  const updated = (await db.execute(sql`
    UPDATE notifications.notification_templates
    SET
      subject_template = ${newSubject},
      body_template = ${newBody},
      updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING id, code, name, subject_template, body_template, updated_at
  `)) as any[]

  return { success: true, message: 'Template berhasil dikembalikan ke format bawaan.', data: updated[0] }
})
