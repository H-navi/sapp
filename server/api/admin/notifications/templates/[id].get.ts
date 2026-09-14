import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.template.manage')
  const id = getRouterParam(event, 'id')
  const db = useDatabase()

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
    WHERE t.id = ${id}::uuid
    LIMIT 1
  `)) as any[]

  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Template notifikasi tidak ditemukan.' })
  }

  return { data: rows[0] }
})
