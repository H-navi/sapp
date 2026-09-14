import { requirePermission } from '~~/server/utils/guard'
import { renderNotificationTemplate, validateTemplatePlaceholders } from '~~/server/services/notification/renderer'

const DEFAULT_SAMPLE_VARS: Record<string, string> = {
  employee_name: 'Budi Santoso',
  employee_nip: '198507122010121001',
  department_name: 'Divisi Teknologi Informasi',
  leave_type_name: 'Cuti Tahunan',
  request_number: 'REQ-2026-0042',
  start_date: 'Senin, 20 Oktober 2026',
  end_date: 'Rabu, 22 Oktober 2026',
  total_days: '3 hari',
  reason: 'Keperluan keluarga di luar kota',
  approver_name: 'Dian Permata',
  step_name: 'Persetujuan Atasan Langsung',
  step_order: '1',
  due_at: '21 Oktober 2026 15:00',
  remaining_time: '18 jam kerja',
  reminder_count: '1',
  action_url: 'http://localhost:3000/approval/sample-task-id',
  decision: 'DISETUJUI',
  decision_reason: 'Disetujui, pekerjaan telah didelegasikan dengan baik.',
  decided_by: 'Dian Permata, S.T. (Manager)',
  quota_balance: '9',
  app_name: 'Sistem Perizinan Pegawai',
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.template.manage')
  const body = await readBody(event)

  const {
    subject_template = '',
    body_template = '',
    channel = 'EMAIL',
    sample_data = {},
  } = body || {}

  // Validasi placeholder
  const valSubject = subject_template ? validateTemplatePlaceholders(subject_template) : { isValid: true, unknownKeys: [] }
  const valBody = validateTemplatePlaceholders(body_template)

  const unknown = [...new Set([...valSubject.unknownKeys, ...valBody.unknownKeys])]

  const mergedVars = { ...DEFAULT_SAMPLE_VARS, ...sample_data }

  const renderedSubject = subject_template
    ? renderNotificationTemplate(subject_template, mergedVars, 'EMAIL')
    : ''
  const renderedBody = renderNotificationTemplate(body_template, mergedVars, channel)

  return {
    success: true,
    isValid: unknown.length === 0,
    unknownKeys: unknown,
    subject: renderedSubject,
    body: renderedBody,
    channel,
  }
})
