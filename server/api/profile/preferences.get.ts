import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  if (!auth.employeeId) {
    return {
      data: {
        emailEnabled: true,
        telegramEnabled: true,
        tasksEnabled: true,
        remindersEnabled: true,
        quietHoursStart: null,
        quietHoursEnd: null,
      },
    }
  }

  const db = useDatabase()
  const rows = (await db.execute(sql`
    SELECT channel, event_type, is_enabled, quiet_hours_start, quiet_hours_end
    FROM notifications.notification_preferences
    WHERE employee_id = ${auth.employeeId}::uuid
  `)) as any[]

  // Setting bawaan
  let emailEnabled = true
  let telegramEnabled = true
  let tasksEnabled = true
  let remindersEnabled = true
  let quietHoursStart: string | null = null
  let quietHoursEnd: string | null = null

  for (const r of rows) {
    if (r.quiet_hours_start) quietHoursStart = String(r.quiet_hours_start).substring(0, 5)
    if (r.quiet_hours_end) quietHoursEnd = String(r.quiet_hours_end).substring(0, 5)

    if (r.channel === 'EMAIL' && !r.event_type) emailEnabled = Boolean(r.is_enabled)
    if (r.channel === 'TELEGRAM' && !r.event_type) telegramEnabled = Boolean(r.is_enabled)

    if (r.event_type === 'APPROVAL_TASK_ASSIGNED') tasksEnabled = Boolean(r.is_enabled)
    if (r.event_type === 'APPROVAL_REMINDER') remindersEnabled = Boolean(r.is_enabled)
  }

  return {
    data: {
      emailEnabled,
      telegramEnabled,
      tasksEnabled,
      remindersEnabled,
      quietHoursStart,
      quietHoursEnd,
    },
  }
})
