import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/id'
import { useDatabase } from '../../database'
import { loadWorkingCalendar, workingHoursBetween } from '../../utils/working-time'
import { escapeTelegramHtml } from './channels/telegram'

dayjs.extend(utc)
dayjs.extend(timezone)

export const ALLOWED_TEMPLATE_VARIABLES = [
  'employee_name',
  'employee_nip',
  'department_name',
  'leave_type_name',
  'request_number',
  'start_date',
  'end_date',
  'total_days',
  'reason',
  'approver_name',
  'step_name',
  'step_order',
  'due_at',
  'remaining_time',
  'reminder_count',
  'action_url',
  'decision',
  'decision_reason',
  'decided_by',
  'quota_balance',
  'app_name',
]

/**
 * Memvalidasi apakah seluruh placeholder {{variabel}} dalam teks terdaftar dalam daftar resmi.
 */
export function validateTemplatePlaceholders(
  templateText: string,
  allowedKeys: string[] = ALLOWED_TEMPLATE_VARIABLES
): { isValid: boolean; unknownKeys: string[] } {
  if (!templateText) return { isValid: true, unknownKeys: [] }

  const matches = templateText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)
  const unknownKeys: string[] = []

  for (const match of matches) {
    const key = match[1]
    if (key && !allowedKeys.includes(key) && !unknownKeys.includes(key)) {
      unknownKeys.push(key)
    }
  }

  return {
    isValid: unknownKeys.length === 0,
    unknownKeys,
  }
}

export interface NotificationContextData {
  requestId?: string | null
  taskId?: string | null
  recipientEmployeeId?: string | null
  targetAudience?: 'APPROVER' | 'REQUESTER' | 'ADMIN' | 'HR'
  extraVars?: Record<string, unknown>
}

/**
 * Membangun kamus nilai 21 variabel lengkap untuk sebuah pengajuan atau tugas approval.
 */
export async function buildNotificationVariables(
  ctx: NotificationContextData,
  tx?: any
): Promise<Record<string, string>> {
  const executor = tx || useDatabase()
  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const appName = process.env.NUXT_PUBLIC_APP_NAME || 'Sistem Perizinan Pegawai'

  let reqData: any = null
  let taskData: any = null
  let quotaBalanceStr = '-'

  // 1. Ambil data pengajuan bila ada requestId
  if (ctx.requestId) {
    const reqRows = (await executor.execute(sql`
      SELECT r.id,
             r.request_number,
             r.employee_id,
             r.start_date::text AS start_date,
             r.end_date::text AS end_date,
             r.total_days::numeric AS total_days,
             r.reason,
             r.status,
             r.decision_reason,
             r.decision_source,
             e.full_name AS requester_name,
             e.nip AS requester_nip,
             d.name AS department_name,
             lt.name AS leave_type_name,
             dec_e.full_name AS decided_by_name
      FROM approvals.leave_requests r
      JOIN org.employees e ON e.id = r.employee_id
      LEFT JOIN org.departments d ON d.id = e.department_id
      JOIN leaves.leave_types lt ON lt.id = r.leave_type_id
      LEFT JOIN org.employees dec_e ON dec_e.id = r.decided_by
      WHERE r.id = ${ctx.requestId}::uuid
      LIMIT 1
    `)) as any[]

    if (reqRows.length > 0) {
      reqData = reqRows[0]

      // Cek sisa kuota aktif
      const qRows = (await executor.execute(sql`
        SELECT balance::numeric AS balance
        FROM leaves.leave_quotas
        WHERE employee_id = ${reqData.employee_id}::uuid
          AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)::smallint
        LIMIT 1
      `)) as any[]
      if (qRows.length > 0 && qRows[0].balance !== null) {
        quotaBalanceStr = String(qRows[0].balance)
      }
    }
  }

  // 2. Ambil data tugas approval bila ada taskId
  if (ctx.taskId) {
    const taskRows = (await executor.execute(sql`
      SELECT t.id,
             t.step_name,
             t.step_order,
             t.due_at,
             t.reminder_count
      FROM approvals.approval_tasks t
      WHERE t.id = ${ctx.taskId}::uuid
      LIMIT 1
    `)) as any[]

    if (taskRows.length > 0) {
      taskData = taskRows[0]
    }
  }

  // 3. Ambil nama approver tujuan jika ada
  let approverName = '-'
  if (ctx.recipientEmployeeId && ctx.targetAudience === 'APPROVER') {
    const appRows = (await executor.execute(sql`
      SELECT full_name FROM org.employees WHERE id = ${ctx.recipientEmployeeId}::uuid LIMIT 1
    `)) as any[]
    if (appRows.length > 0) {
      approverName = appRows[0].full_name
    }
  }

  // Format tanggal
  const startDateStr = reqData?.start_date
    ? dayjs(reqData.start_date).tz('Asia/Jakarta').locale('id').format('dddd, D MMMM YYYY')
    : '-'
  const endDateStr = reqData?.end_date
    ? dayjs(reqData.end_date).tz('Asia/Jakarta').locale('id').format('dddd, D MMMM YYYY')
    : '-'
  const dueAtStr = taskData?.due_at
    ? dayjs(taskData.due_at).tz('Asia/Jakarta').locale('id').format('D MMMM YYYY HH:mm')
    : '-'

  // Hitung sisa jam kerja
  let remainingTimeStr = '-'
  if (taskData?.due_at) {
    try {
      const cal = await loadWorkingCalendar()
      const now = new Date()
      const due = new Date(taskData.due_at)
      if (due > now) {
        const hours = workingHoursBetween(now, due, cal)
        const wholeHours = Math.floor(hours)
        const mins = Math.round((hours - wholeHours) * 60)
        remainingTimeStr = mins > 0 ? `${wholeHours} jam ${mins} menit kerja` : `${wholeHours} jam kerja`
      } else {
        remainingTimeStr = 'Melewati batas SLA'
      }
    } catch {
      remainingTimeStr = '-'
    }
  }

  // Action URL
  let actionUrl = baseUrl
  if (ctx.targetAudience === 'APPROVER' && ctx.taskId) {
    actionUrl = `${baseUrl}/approval/${ctx.taskId}`
  } else if (ctx.requestId) {
    actionUrl = `${baseUrl}/pengajuan/${ctx.requestId}`
  }

  // Decision & Reason
  let decisionStr = '-'
  if (reqData?.status === 'APPROVED') decisionStr = 'DISETUJUI'
  else if (reqData?.status === 'REJECTED') decisionStr = 'DITOLAK'
  else if (reqData?.status === 'EXPIRED') decisionStr = 'KEDALUWARSA'

  const decidedByStr = reqData?.decision_source === 'SYSTEM_AUTO'
    ? 'SISTEM (Otomatis)'
    : reqData?.decided_by_name || '-'

  const vars: Record<string, string> = {
    employee_name: reqData?.requester_name || '-',
    employee_nip: reqData?.requester_nip || '-',
    department_name: reqData?.department_name || '-',
    leave_type_name: reqData?.leave_type_name || '-',
    request_number: reqData?.request_number || '-',
    start_date: startDateStr,
    end_date: endDateStr,
    total_days: reqData?.total_days ? `${reqData.total_days} hari` : '-',
    reason: reqData?.reason || '-',
    approver_name: approverName,
    step_name: taskData?.step_name || '-',
    step_order: taskData?.step_order ? String(taskData.step_order) : '-',
    due_at: dueAtStr,
    remaining_time: remainingTimeStr,
    reminder_count: taskData?.reminder_count !== undefined ? String(taskData.reminder_count) : '-',
    action_url: actionUrl,
    decision: decisionStr,
    decision_reason: reqData?.decision_reason || '-',
    decided_by: decidedByStr,
    quota_balance: quotaBalanceStr,
    app_name: appName,
  }

  // Tambahkan extraVars bila ada
  if (ctx.extraVars) {
    for (const [k, v] of Object.entries(ctx.extraVars)) {
      if (v !== undefined && v !== null) {
        vars[k] = Array.isArray(v) ? v.join(', ') : String(v)
      }
    }
  }

  return vars
}

/**
 * Merender template teks dengan mengganti seluruh {{key}} sesuai kamus variabel.
 * Jika channel adalah TELEGRAM, nilai variabel di-escape agar aman terhadap parse_mode='HTML'.
 */
export function renderNotificationTemplate(
  templateText: string,
  variables: Record<string, any>,
  channel: 'EMAIL' | 'TELEGRAM' | 'IN_APP' = 'EMAIL'
): string {
  if (!templateText) return ''

  return templateText.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    const rawVal = variables[key]
    let valStr: string
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      valStr = '-'
    } else if (Array.isArray(rawVal)) {
      valStr = rawVal.join(', ')
    } else {
      valStr = String(rawVal)
    }

    if (channel === 'TELEGRAM') {
      return escapeTelegramHtml(valStr)
    }
    return valStr
  })
}

