import dayjs from 'dayjs'
import 'dayjs/locale/id'
import type { RuleContext } from './types'

dayjs.locale('id')

export function renderMessage(template: string, vars: Record<string, unknown>): string {
  if (!template) return ''
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => {
    const v = vars[key]
    if (v === undefined || v === null) return '-'
    if (Array.isArray(v)) return v.join(', ')
    return String(v)
  })
}

export function baseVars(ctx: RuleContext): Record<string, unknown> {
  const startFmt = ctx.request.startDate ? dayjs(ctx.request.startDate).format('D MMMM YYYY') : '-'
  const endFmt = ctx.request.endDate ? dayjs(ctx.request.endDate).format('D MMMM YYYY') : '-'

  return {
    employee_name: ctx.employee.name ?? '-',
    leave_type_name: ctx.leaveType.name,
    leave_type_code: ctx.leaveType.code,
    requested_days: ctx.request.totalDays,
    working_days: ctx.request.workingDays,
    start_date: startFmt,
    end_date: endFmt,
    raw_start_date: ctx.request.startDate,
    raw_end_date: ctx.request.endDate,
    employment_status: ctx.employee.employmentStatus,
    today: ctx.today,
  }
}
