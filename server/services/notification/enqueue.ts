import { sql } from 'drizzle-orm'
import { useDatabase } from '../../database'
import * as schema from '../../database/schema'

export interface EnqueueNotificationInput {
  templateId?: string | null
  eventType: (typeof schema.notificationEventEnum.enumValues)[number]
  channel: (typeof schema.notificationChannelEnum.enumValues)[number]
  recipientEmployeeId?: string | null
  recipientAddress: string
  subject?: string | null
  body: string
  scheduledAt?: Date
  requestId?: string | null
  taskId?: string | null
  dedupeKey?: string | null
  payload?: Record<string, any>
}

/**
 * Memasukkan notifikasi ke dalam antrean (tabel notifications).
 * Aman dipanggil berulang kali (idempoten) berkat penanganan dedupe_key.
 */
export async function queueNotification(input: EnqueueNotificationInput, tx?: any) {
  const executor = tx || useDatabase()

  const values = {
    templateId: input.templateId || null,
    eventType: input.eventType,
    channel: input.channel,
    recipientEmployeeId: input.recipientEmployeeId || null,
    recipientAddress: input.recipientAddress,
    subject: input.subject || null,
    body: input.body,
    status: 'QUEUED' as const,
    attemptCount: 0,
    maxAttempts: 3,
    scheduledAt: input.scheduledAt || new Date(),
    requestId: input.requestId || null,
    taskId: input.taskId || null,
    dedupeKey: input.dedupeKey || null,
    payload: input.payload || {},
  }

  if (input.dedupeKey) {
    // Gunakan ON CONFLICT (dedupe_key) DO NOTHING
    const result = await executor.execute(sql`
      INSERT INTO notifications (
        template_id, event_type, channel, recipient_employee_id,
        recipient_address, subject, body, status, attempt_count,
        max_attempts, scheduled_at, request_id, task_id, dedupe_key, payload
      ) VALUES (
        ${values.templateId}::uuid,
        ${values.eventType}::notification_event_enum,
        ${values.channel}::notification_channel_enum,
        ${values.recipientEmployeeId}::uuid,
        ${values.recipientAddress},
        ${values.subject},
        ${values.body},
        ${values.status}::notification_status_enum,
        ${values.attemptCount},
        ${values.maxAttempts},
        ${(values.scheduledAt || new Date()).toISOString()}::timestamptz,
        ${values.requestId}::uuid,
        ${values.taskId}::uuid,
        ${values.dedupeKey},
        ${JSON.stringify(values.payload)}::jsonb
      )
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
      RETURNING id
    `)
    return (result as any[])[0]?.id || null
  }

  const [inserted] = await executor.insert(schema.notifications).values(values).returning({ id: schema.notifications.id })
  return inserted?.id || null
}
