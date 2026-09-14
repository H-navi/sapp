import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import { validateTemplatePlaceholders } from '~~/server/services/notification/renderer'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.template.manage')
  const body = await readBody(event)
  const db = useDatabase()

  const {
    code,
    name,
    event_type,
    channel,
    target_audience = 'APPROVER',
    leave_type_id = null,
    workflow_step_id = null,
    employee_id = null,
    locale = 'id-ID',
    subject_template = null,
    body_template,
    parse_mode = 'HTML',
    is_active = true,
  } = body || {}

  if (!code || !name || !event_type || !channel || !body_template) {
    throw createError({
      statusCode: 400,
      message: 'Kode, nama, jenis event, kanal, dan isi template wajib diisi.',
    })
  }

  // Validasi placeholder pada subjek & isi
  const valSubject = subject_template ? validateTemplatePlaceholders(subject_template) : { isValid: true, unknownKeys: [] }
  const valBody = validateTemplatePlaceholders(body_template)

  const unknown = [...new Set([...valSubject.unknownKeys, ...valBody.unknownKeys])]
  if (unknown.length > 0) {
    throw createError({
      statusCode: 400,
      message: `Terdapat variabel tidak dikenal dalam template: ${unknown.map((k) => `{{${k}}}`).join(', ')}`,
    })
  }

  try {
    const result = (await db.execute(sql`
      INSERT INTO notifications.notification_templates (
        code,
        name,
        event_type,
        channel,
        target_audience,
        leave_type_id,
        workflow_step_id,
        employee_id,
        locale,
        subject_template,
        body_template,
        parse_mode,
        is_default,
        is_active,
        created_by
      ) VALUES (
        ${code},
        ${name},
        ${event_type}::public.notification_event_enum,
        ${channel}::public.notification_channel_enum,
        ${target_audience},
        ${leave_type_id ? leave_type_id : null}::uuid,
        ${workflow_step_id ? workflow_step_id : null}::uuid,
        ${employee_id ? employee_id : null}::uuid,
        ${locale},
        ${subject_template},
        ${body_template},
        ${parse_mode},
        false,
        ${is_active},
        ${auth.userId}::uuid
      )
      RETURNING id, code, name, event_type, channel, target_audience, created_at
    `)) as any[]

    return { success: true, data: result[0] }
  } catch (err: any) {
    if (err?.code === '23505') {
      throw createError({
        statusCode: 400,
        message: 'Kode template sudah digunakan. Gunakan kode unik lain.',
      })
    }
    throw err
  }
})
