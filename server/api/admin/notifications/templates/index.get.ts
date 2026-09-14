import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.template.manage')
  const query = getQuery(event)
  const db = useDatabase()

  const eventType = query.event_type ? String(query.event_type).trim() : null
  const channel = query.channel ? String(query.channel).trim() : null
  const targetAudience = query.target_audience ? String(query.target_audience).trim() : null
  const search = query.search ? `%${String(query.search).trim()}%` : null

  const rows = (await db.execute(sql`
    SELECT 
      t.id,
      t.code,
      t.name,
      t.event_type,
      t.channel,
      t.target_audience,
      t.leave_type_id,
      t.workflow_step_id,
      t.employee_id,
      t.locale,
      t.subject_template,
      t.body_template,
      t.parse_mode,
      t.is_default,
      t.is_active,
      t.created_at,
      t.updated_at,
      lt.name AS leave_type_name,
      ws.name AS workflow_step_name,
      e.full_name AS employee_name
    FROM notifications.notification_templates t
    LEFT JOIN leaves.leave_types lt ON lt.id = t.leave_type_id
    LEFT JOIN approvals.approval_workflow_steps ws ON ws.id = t.workflow_step_id
    LEFT JOIN org.employees e ON e.id = t.employee_id
    WHERE (${eventType}::text IS NULL OR t.event_type::text = ${eventType})
      AND (${channel}::text IS NULL OR t.channel::text = ${channel})
      AND (${targetAudience}::text IS NULL OR t.target_audience = ${targetAudience})
      AND (${search}::text IS NULL OR t.name ILIKE ${search} OR t.code ILIKE ${search} OR t.subject_template ILIKE ${search})
    ORDER BY t.event_type ASC, t.channel ASC, t.target_audience ASC, t.is_default DESC, t.name ASC
  `)) as any[]

  return { data: rows }
})
