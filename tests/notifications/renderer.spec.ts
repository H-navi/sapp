import { describe, it, expect } from 'vitest'
import {
  validateTemplatePlaceholders,
  renderNotificationTemplate,
  ALLOWED_TEMPLATE_VARIABLES,
} from '../../server/services/notification/renderer'
import { escapeTelegramHtml } from '../../server/services/notification/channels/telegram'

describe('Notification Renderer & Sanitization', () => {
  describe('validateTemplatePlaceholders', () => {
    it('menganggap template valid jika semua variabel terdaftar', () => {
      const text = 'Halo {{employee_name}}, pengajuan {{leave_type_name}} Anda nomor {{request_number}} telah disetujui.'
      const res = validateTemplatePlaceholders(text)
      expect(res.isValid).toBe(true)
      expect(res.unknownKeys).toHaveLength(0)
    })

    it('mendeteksi variabel tidak dikenal', () => {
      const text = 'Halo {{employee_name}}, saldo poin Anda {{point_balance}} dan token {{secret_token}}.'
      const res = validateTemplatePlaceholders(text)
      expect(res.isValid).toBe(false)
      expect(res.unknownKeys).toContain('point_balance')
      expect(res.unknownKeys).toContain('secret_token')
    })

    it('mengembalikan valid untuk teks tanpa placeholder', () => {
      const text = 'Pemberitahuan sistem: server akan di-restart malam ini.'
      const res = validateTemplatePlaceholders(text)
      expect(res.isValid).toBe(true)
      expect(res.unknownKeys).toHaveLength(0)
    })
  })

  describe('renderNotificationTemplate', () => {
    it('mengganti variabel sesuai kamus nilai', () => {
      const template = 'Halo {{employee_name}}, Anda mengajukan {{leave_type_name}} selama {{total_days}}.'
      const vars = {
        employee_name: 'Budi Santoso',
        leave_type_name: 'Cuti Tahunan',
        total_days: '3 hari',
      }
      const rendered = renderNotificationTemplate(template, vars, 'EMAIL')
      expect(rendered).toBe('Halo Budi Santoso, Anda mengajukan Cuti Tahunan selama 3 hari.')
    })

    it('mengganti variabel yang tidak ada nilainya dengan fallback "-"', () => {
      const template = 'Alasan: {{reason}}, Catatan: {{decision_reason}}'
      const vars = {
        reason: 'Urusan keluarga',
      }
      const rendered = renderNotificationTemplate(template, vars, 'EMAIL')
      expect(rendered).toBe('Alasan: Urusan keluarga, Catatan: -')
    })

    it('menggabungkan nilai array dengan koma', () => {
      const template = 'Approver yang ditugaskan: {{approver_list}}'
      const vars = {
        approver_list: ['Ahmad Fauzi', 'Siti Rahma', 'Budi Santoso'],
      }
      const rendered = renderNotificationTemplate(template, vars, 'EMAIL')
      expect(rendered).toBe('Approver yang ditugaskan: Ahmad Fauzi, Siti Rahma, Budi Santoso')
    })

    it('mengganti placeholder yang tidak dikenal atau null dengan "-"', () => {
      const template = 'Info: {{unknown_param}}, Catatan: {{note}}'
      const vars = {
        note: null,
      }
      const rendered = renderNotificationTemplate(template, vars, 'EMAIL')
      expect(rendered).toBe('Info: -, Catatan: -')
    })
  })


  describe('Telegram HTML Escaping', () => {
    it('escapeTelegramHtml membersihkan karakter HTML berbahaya', () => {
      const raw = 'Perusahaan <PT Maju & Sukses> "Divisi IT"'
      const escaped = escapeTelegramHtml(raw)
      expect(escaped).toBe('Perusahaan &lt;PT Maju &amp; Sukses&gt; "Divisi IT"')
    })

    it('renderNotificationTemplate melakukan escape pada variabel saat channel TELEGRAM', () => {
      const template = '<b>Pemohon:</b> {{employee_name}}\n<b>Departemen:</b> {{department_name}}'
      const vars = {
        employee_name: 'Ahmad <ahmad@kantor.com>',
        department_name: 'R&D & QA',
      }
      const rendered = renderNotificationTemplate(template, vars, 'TELEGRAM')
      // Tag HTML asli template tetap utuh
      expect(rendered).toContain('<b>Pemohon:</b>')
      // Variabel terinterpolasi harus di-escape
      expect(rendered).toContain('Ahmad &lt;ahmad@kantor.com&gt;')
      expect(rendered).toContain('R&amp;D &amp; QA')
    })
  })
})
