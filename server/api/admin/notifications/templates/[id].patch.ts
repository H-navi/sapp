import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import { validateTemplatePlaceholders } from '~~/server/services/notification/renderer'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.template.manage')
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const db = useDatabase()

  const {
    name,
    subject_template,
    body_template,
    parse_mode,
    is_active,
  } = body || {}

  // Validasi template exists
  const existing = (await db.execute(sql`
    SELECT id, code, is_default FROM notifications.notification_templates WHERE id = ${id}::uuid LIMIT 1
  `)) as any[]

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: 'Template notifikasi tidak ditemukan.' })
  }

  // Validasi placeholder jika body_template atau subject_template disediakan
  if (body_template !== undefined) {
    const valBody = validateTemplatePlaceholders(body_template)
    if (!valBody.isValid) {
      throw createError({
        statusCode: 400,
        message: `Terdapat variabel tidak dikenal dalam isi template: ${valBody.unknownKeys.map((k) => `{{${k}}}`).join(', ')}`,
      })
    }
  }

  if (subject_template !== undefined && subject_template !== null) {
    const valSubject = validateTemplatePlaceholders(subject_template)
    if (!valSubject.isValid) {
      throw createError({
        statusCode: 400,
        message: `Terdapat variabel tidak dikenal dalam subjek template: ${valSubject.unknownKeys.map((k) => `{{${k}}}`).join(', ')}`,
      })
    }
  }

  const updated = (await db.execute(sql`
    UPDATE notifications.notification_templates
    SET
      name = COALESCE(${name}, name),
      subject_template = CASE WHEN ${subject_template !== undefined} THEN ${subject_template} ELSE subject_template END,
      body_template = COALESCE(${body_template}, body_template),
      parse_mode = COALESCE(${parse_mode}, parse_mode),
      is_active = CASE WHEN ${is_active !== undefined} THEN ${Boolean(is_active)} ELSE is_active END,
      updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING id, code, name, subject_template, body_template, parse_mode, is_active, updated_at
  `)) as any[]

  return { success: true, data: updated[0] }
})
