import { sql } from 'drizzle-orm'
import { useDatabase } from '../../database'

export interface ResolveTemplateInput {
  eventType: string
  channel: string
  targetAudience: string
  employeeId?: string | null
  workflowStepId?: string | null
  leaveTypeId?: string | null
}

export interface ResolvedTemplate {
  id: string
  code: string
  name: string
  subjectTemplate: string | null
  bodyTemplate: string
  parseMode: string
  isDefault: boolean
}

/**
 * Mencari template notifikasi paling spesifik sesuai hierarki:
 * 1. Khusus pegawai (employee_id)
 * 2. Khusus tahap approval (workflow_step_id)
 * 3. Khusus jenis izin (leave_type_id)
 * 4. Template bawaan sistem (is_default)
 */
export async function resolveNotificationTemplate(
  input: ResolveTemplateInput,
  tx?: any
): Promise<ResolvedTemplate | null> {
  const executor = tx || useDatabase()

  const rows = (await executor.execute(sql`
    SELECT id,
           code,
           name,
           subject_template AS "subjectTemplate",
           body_template AS "bodyTemplate",
           parse_mode AS "parseMode",
           is_default AS "isDefault"
    FROM notifications.notification_templates
    WHERE is_active = true
      AND event_type = ${input.eventType}::notification_event_enum
      AND channel = ${input.channel}::notification_channel_enum
      AND target_audience = ${input.targetAudience}
      AND (employee_id IS NULL OR employee_id = ${input.employeeId}::uuid)
      AND (workflow_step_id IS NULL OR workflow_step_id = ${input.workflowStepId}::uuid)
      AND (leave_type_id IS NULL OR leave_type_id = ${input.leaveTypeId}::uuid)
    ORDER BY (employee_id IS NOT NULL) DESC,
             (workflow_step_id IS NOT NULL) DESC,
             (leave_type_id IS NOT NULL) DESC,
             is_default DESC
    LIMIT 1
  `)) as any[]

  if (rows.length === 0) {
    return null
  }

  return rows[0] as ResolvedTemplate
}
