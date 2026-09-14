import { sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { useDatabase } from '../../database'
import * as schema from '../../database/schema'
import { resolveNotificationTemplate } from './template-resolver'
import { buildNotificationVariables, renderNotificationTemplate } from './renderer'

dayjs.extend(utc)
dayjs.extend(timezone)

export interface EnqueueNotificationInput {
  templateId?: string | null
  eventType?: (typeof schema.notificationEventEnum.enumValues)[number]
  event?: (typeof schema.notificationEventEnum.enumValues)[number]
  channel?: (typeof schema.notificationChannelEnum.enumValues)[number]
  channels?: Array<(typeof schema.notificationChannelEnum.enumValues)[number]>
  audience?: 'REQUESTER' | 'APPROVER' | 'ADMIN' | 'HR'
  recipientEmployeeId?: string | null
  recipientAddress?: string
  subject?: string | null
  body?: string
  scheduledAt?: Date
  requestId?: string | null
  taskId?: string | null
  dedupeKey?: string | null
  payload?: Record<string, any>
  extraVars?: Record<string, unknown>
}

/**
 * Hitung waktu scheduled_at dengan mempertimbangkan jam tenang (quiet hours).
 * Kecuali untuk event keputusan akhir (REQUEST_APPROVED/REJECTED), yang selalu dikirim seketika.
 */
function calculateScheduledTime(
  now: Date,
  quietStartStr?: string | null,
  quietEndStr?: string | null,
  isExempt = false
): Date {
  if (isExempt || !quietStartStr || !quietEndStr) {
    return now
  }

  const nowTz = dayjs(now).tz('Asia/Jakarta')
  const currentTime = nowTz.format('HH:mm:ss')

  const startFormatted = quietStartStr.length === 5 ? `${quietStartStr}:00` : quietStartStr
  const endFormatted = quietEndStr.length === 5 ? `${quietEndStr}:00` : quietEndStr

  let isInQuietHours = false
  let resumeDate = nowTz

  if (startFormatted <= endFormatted) {
    // Jam tenang dalam hari yang sama (misal 12:00 - 13:00)
    if (currentTime >= startFormatted && currentTime < endFormatted) {
      isInQuietHours = true
      const [endH = 0, endM = 0] = endFormatted.split(':').map(Number)
      resumeDate = nowTz.hour(endH).minute(endM).second(0).millisecond(0)
    }
  } else {
    // Jam tenang melintasi tengah malam (misal 22:00 - 06:00)
    if (currentTime >= startFormatted || currentTime < endFormatted) {
      isInQuietHours = true
      const [endH = 0, endM = 0] = endFormatted.split(':').map(Number)
      if (currentTime >= startFormatted) {
        // Lewat tengah malam (besok pagi)
        resumeDate = nowTz.add(1, 'day').hour(endH).minute(endM).second(0).millisecond(0)
      } else {
        // Sebelum subuh hari ini
        resumeDate = nowTz.hour(endH).minute(endM).second(0).millisecond(0)
      }
    }
  }

  return isInQuietHours ? resumeDate.toDate() : now
}

/**
 * Memasukkan notifikasi ke dalam antrean (tabel notifications).
 * Aman dipanggil berulang kali (idempoten) berkat penanganan dedupe_key.
 */
export async function queueNotification(input: EnqueueNotificationInput, tx?: any) {
  const executor = tx || useDatabase()
  const eventType = input.eventType || input.event
  if (!eventType) {
    throw new Error('eventType atau event wajib ditentukan pada queueNotification.')
  }

  const now = new Date()
  const isFinalDecision = [
    'REQUEST_APPROVED',
    'REQUEST_REJECTED',
    'REQUEST_AUTO_APPROVED',
    'REQUEST_AUTO_REJECTED',
  ].includes(eventType)

  // 1. Jika pemanggil langsung menyediakan subject & body lengkap
  if (input.body && input.recipientAddress && input.channel) {
    const scheduledAt = input.scheduledAt || now
    const values = {
      templateId: input.templateId || null,
      eventType,
      channel: input.channel,
      recipientEmployeeId: input.recipientEmployeeId || null,
      recipientAddress: input.recipientAddress,
      subject: input.subject || null,
      body: input.body,
      status: 'QUEUED' as const,
      attemptCount: 0,
      maxAttempts: 3,
      scheduledAt,
      requestId: input.requestId || null,
      taskId: input.taskId || null,
      dedupeKey: input.dedupeKey || null,
      payload: input.payload || {},
    }

    if (input.dedupeKey) {
      const result = await executor.execute(sql`
        INSERT INTO notifications.notifications (
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
          ${(values.scheduledAt || now).toISOString()}::timestamptz,
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

    const [inserted] = await executor
      .insert(schema.notifications)
      .values(values)
      .returning({ id: schema.notifications.id })
    return inserted?.id || null
  }

  // 2. Alur Resolusi Template Dinamis
  if (!input.recipientEmployeeId) {
    console.warn('[queueNotification] recipientEmployeeId kosong dan body tidak disertakan, dilewati.')
    return null
  }

  // Ambil data pegawai penerima
  const empRows = (await executor.execute(sql`
    SELECT id, full_name, email, telegram_chat_id
    FROM org.employees
    WHERE id = ${input.recipientEmployeeId}::uuid
    LIMIT 1
  `)) as any[]

  if (empRows.length === 0) return null
  const emp = empRows[0]

  // Ambil preferensi notifikasi penerima
  const prefRows = (await executor.execute(sql`
    SELECT channel, is_enabled, quiet_hours_start, quiet_hours_end
    FROM notifications.notification_preferences
    WHERE employee_id = ${input.recipientEmployeeId}::uuid
      AND (event_type IS NULL OR event_type = ${eventType}::notification_event_enum)
  `)) as any[]

  const prefMap = new Map<string, any>()
  for (const p of prefRows) {
    prefMap.set(p.channel, p)
  }

  // Tentukan channel yang akan dikirimi
  const targetChannels = input.channels || (input.channel ? [input.channel] : ['EMAIL', 'TELEGRAM', 'IN_APP'])
  const audience = input.audience || (input.taskId ? 'APPROVER' : 'REQUESTER')

  // Ambil leaveTypeId & workflowStepId untuk spesifisitas template
  let leaveTypeId: string | null = null
  let workflowStepId: string | null = null

  if (input.requestId) {
    const rRows = (await executor.execute(sql`
      SELECT leave_type_id FROM approvals.leave_requests WHERE id = ${input.requestId}::uuid LIMIT 1
    `)) as any[]
    leaveTypeId = rRows[0]?.leave_type_id || null
  }
  if (input.taskId) {
    const tRows = (await executor.execute(sql`
      SELECT workflow_step_id FROM approvals.approval_tasks WHERE id = ${input.taskId}::uuid LIMIT 1
    `)) as any[]
    workflowStepId = tRows[0]?.workflow_step_id || null
  }

  // Bangun kamus variabel
  const variables = await buildNotificationVariables(
    {
      requestId: input.requestId,
      taskId: input.taskId,
      recipientEmployeeId: input.recipientEmployeeId,
      targetAudience: audience,
      extraVars: input.extraVars,
    },
    executor
  )

  for (const ch of targetChannels) {
    const pref = prefMap.get(ch)

    // Cek apakah kanal dimatikan (kecuali jika event keputusan akhir di mana email wajib tetap jalan)
    if (pref && pref.is_enabled === false && !isFinalDecision) {
      continue
    }

    // Tentukan alamat penerima
    let recipientAddress: string | null = null
    if (ch === 'EMAIL') {
      recipientAddress = emp.email || null
    } else if (ch === 'TELEGRAM') {
      recipientAddress = emp.telegram_chat_id || null
    } else if (ch === 'IN_APP') {
      recipientAddress = emp.id
    }

    if (!recipientAddress) {
      // Lewati bila alamat kanal kosong (misal telegram belum ditautkan)
      continue
    }

    // Resolusi template
    const template = await resolveNotificationTemplate(
      {
        eventType,
        channel: ch,
        targetAudience: audience,
        employeeId: input.recipientEmployeeId,
        workflowStepId,
        leaveTypeId,
      },
      executor
    )

    if (!template) {
      // Lewati bila template untuk kanal ini belum dibuat
      continue
    }

    // Render pesan
    const renderedSubject = template.subjectTemplate
      ? renderNotificationTemplate(template.subjectTemplate, variables, ch)
      : null
    const renderedBody = renderNotificationTemplate(template.bodyTemplate, variables, ch)

    // Hitung jadwal pengiriman dengan jam tenang
    const scheduledAt = calculateScheduledTime(
      now,
      pref?.quiet_hours_start,
      pref?.quiet_hours_end,
      isFinalDecision
    )

    const dedupeKey = input.dedupeKey
      ? `${input.dedupeKey}:${ch}`
      : `notif:${eventType}:${emp.id}:${ch}:${input.requestId || ''}:${input.taskId || ''}`

    // Insert ke notifications
    await executor.execute(sql`
      INSERT INTO notifications.notifications (
        template_id, event_type, channel, recipient_employee_id,
        recipient_address, subject, body, status, attempt_count,
        max_attempts, scheduled_at, request_id, task_id, dedupe_key, payload
      ) VALUES (
        ${template.id}::uuid,
        ${eventType}::notification_event_enum,
        ${ch}::notification_channel_enum,
        ${emp.id}::uuid,
        ${recipientAddress},
        ${renderedSubject},
        ${renderedBody},
        'QUEUED'::notification_status_enum,
        0,
        3,
        ${scheduledAt.toISOString()}::timestamptz,
        ${input.requestId || null}::uuid,
        ${input.taskId || null}::uuid,
        ${dedupeKey},
        ${JSON.stringify({ ...input.payload, parseMode: template.parseMode })}::jsonb
      )
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    `)

    // Cadangkan ke in-app notification bila channel IN_APP atau selalu dibuat
    if (ch === 'IN_APP') {
      await executor.execute(sql`
        INSERT INTO notifications.in_app_notifications (
          employee_id, title, body, url, event_type, request_id
        ) VALUES (
          ${emp.id}::uuid,
          ${renderedSubject || 'Pemberitahuan Perizinan'},
          ${renderedBody},
          ${variables.action_url || null},
          ${eventType}::notification_event_enum,
          ${input.requestId || null}::uuid
        )
      `)
    }
  }

  return null
}
