import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import { ALLOWED_TEMPLATE_VARIABLES } from '~~/server/services/notification/renderer'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.template.manage')
  const db = useDatabase()

  try {
    const rows = (await db.execute(sql`
      SELECT id, variable_key, description, example_value, applies_to, sort_order
      FROM notifications.notification_template_variables
      ORDER BY sort_order ASC, variable_key ASC
    `)) as any[]

    if (rows.length > 0) {
      return { data: rows }
    }
  } catch {
    // fallback if table is empty or error
  }

  // Fallback if DB table has not been loaded or empty
  const fallback = ALLOWED_TEMPLATE_VARIABLES.map((key, idx) => ({
    id: `var-${key}`,
    variable_key: `{{${key}}}`,
    description: `Variabel ${key}`,
    example_value: `[Contoh ${key}]`,
    applies_to: [],
    sort_order: idx + 1,
  }))

  return { data: fallback }
})
