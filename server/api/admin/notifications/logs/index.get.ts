import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.template.manage')
  const query = getQuery(event)
  const db = useDatabase()

  const page = Math.max(1, Number(query.page || 1))
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)))
  const offset = (page - 1) * limit

  const status = query.status ? String(query.status).trim() : null
  const channel = query.channel ? String(query.channel).trim() : null
  const eventType = query.event_type ? String(query.event_type).trim() : null
  const search = query.search ? `%${String(query.search).trim()}%` : null

  // 1. Ambil metrik ringkasan 24 jam
  const statsRows = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_24h,
      COUNT(*) FILTER (WHERE status = 'SENT')::int AS sent_24h,
      COUNT(*) FILTER (WHERE status IN ('QUEUED', 'SENDING'))::int AS queued_24h,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_24h
    FROM notifications.notifications
    WHERE created_at >= (now() - interval '24 hours')
  `)) as any[]

  const stats = statsRows[0] || { total_24h: 0, sent_24h: 0, queued_24h: 0, failed_24h: 0 }

  // 2. Ambil total count untuk pagination
  const countRows = (await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM notifications.notifications n
    LEFT JOIN org.employees e ON e.id = n.recipient_employee_id
    WHERE (${status}::text IS NULL OR n.status::text = ${status})
      AND (${channel}::text IS NULL OR n.channel::text = ${channel})
      AND (${eventType}::text IS NULL OR n.event_type::text = ${eventType})
      AND (${search}::text IS NULL OR n.recipient_address ILIKE ${search} OR n.subject ILIKE ${search} OR e.full_name ILIKE ${search})
  `)) as any[]

  const total = countRows[0]?.total || 0

  // 3. Ambil baris data
  const rows = (await db.execute(sql`
    SELECT
      n.id,
      n.template_id,
      n.event_type,
      n.channel,
      n.recipient_employee_id,
      n.recipient_address,
      n.subject,
      n.body,
      n.status,
      n.attempt_count,
      n.max_attempts,
      n.scheduled_at,
      n.sent_at,
      n.failed_at,
      n.error_message,
      n.provider_message_id,
      n.request_id,
      n.task_id,
      n.created_at,
      e.full_name AS recipient_name,
      e.nip AS recipient_nip
    FROM notifications.notifications n
    LEFT JOIN org.employees e ON e.id = n.recipient_employee_id
    WHERE (${status}::text IS NULL OR n.status::text = ${status})
      AND (${channel}::text IS NULL OR n.channel::text = ${channel})
      AND (${eventType}::text IS NULL OR n.event_type::text = ${eventType})
      AND (${search}::text IS NULL OR n.recipient_address ILIKE ${search} OR n.subject ILIKE ${search} OR e.full_name ILIKE ${search})
    ORDER BY n.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as any[]

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats,
  }
})
