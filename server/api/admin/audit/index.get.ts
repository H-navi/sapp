import { sql } from 'drizzle-orm'
import { requireAuth } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

function sanitizeAuditValues(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeAuditValues)

  const sanitized: Record<string, any> = {}
  for (const [key, val] of Object.entries(obj)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('hash')
    ) {
      sanitized[key] = '*** [DISAMARKAN] ***'
    } else if (val && typeof val === 'object') {
      sanitized[key] = sanitizeAuditValues(val)
    } else {
      sanitized[key] = val
    }
  }
  return sanitized
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const isAdmin = auth.roles.includes('ADMIN')
  const hasPerm =
    auth.permissions.includes('admin.setting.manage') ||
    auth.permissions.includes('system.audit.view') ||
    auth.permissions.includes('system.config.view')

  if (!isAdmin && !hasPerm) {
    throw createError({ statusCode: 403, message: 'Akses ditolak: Anda tidak memiliki wewenang melihat log audit.' })
  }

  const query = getQuery(event)
  const db = useDatabase()

  const page = Math.max(1, Number(query.page || 1))
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)))
  const offset = (page - 1) * limit

  const entityType = query.entity_type ? String(query.entity_type).trim() : null
  const action = query.action ? String(query.action).trim() : null
  const search = query.search ? `%${String(query.search).trim()}%` : null
  const fromDate = query.from ? String(query.from).trim() : null
  const toDate = query.to ? String(query.to).trim() : null

  // Total count
  const countRows = (await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM system.audit_logs l
    LEFT JOIN auth.users u ON u.id = l.actor_user_id
    LEFT JOIN org.employees e ON e.user_id = u.id
    WHERE (${entityType}::text IS NULL OR l.entity_type = ${entityType})
      AND (${action}::text IS NULL OR l.action = ${action})
      AND (${fromDate}::date IS NULL OR l.created_at::date >= ${fromDate}::date)
      AND (${toDate}::date IS NULL OR l.created_at::date <= ${toDate}::date)
      AND (
        ${search}::text IS NULL
        OR l.entity_type ILIKE ${search}
        OR l.action ILIKE ${search}
        OR u.username ILIKE ${search}
        OR e.full_name ILIKE ${search}
      )
  `)) as any[]

  const total = countRows[0]?.total || 0

  // Records
  const rows = (await db.execute(sql`
    SELECT
      l.id,
      l.actor_user_id AS "actorUserId",
      l.actor_type AS "actorType",
      l.action,
      l.entity_type AS "entityType",
      l.entity_id AS "entityId",
      l.old_values AS "oldValues",
      l.new_values AS "newValues",
      l.ip_address AS "ipAddress",
      l.user_agent AS "userAgent",
      l.created_at AS "createdAt",
      u.username AS "actorUsername",
      e.full_name AS "actorFullName"
    FROM system.audit_logs l
    LEFT JOIN auth.users u ON u.id = l.actor_user_id
    LEFT JOIN org.employees e ON e.user_id = u.id
    WHERE (${entityType}::text IS NULL OR l.entity_type = ${entityType})
      AND (${action}::text IS NULL OR l.action = ${action})
      AND (${fromDate}::date IS NULL OR l.created_at::date >= ${fromDate}::date)
      AND (${toDate}::date IS NULL OR l.created_at::date <= ${toDate}::date)
      AND (
        ${search}::text IS NULL
        OR l.entity_type ILIKE ${search}
        OR l.action ILIKE ${search}
        OR u.username ILIKE ${search}
        OR e.full_name ILIKE ${search}
      )
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as any[]

  // Distinct entity_types dan actions untuk filter
  const filterOptions = (await db.execute(sql`
    SELECT
      ARRAY(SELECT DISTINCT entity_type FROM system.audit_logs ORDER BY entity_type ASC) AS "entityTypes",
      ARRAY(SELECT DISTINCT action FROM system.audit_logs ORDER BY action ASC) AS "actions"
  `)) as any[]

  const sanitizedRows = rows.map((r) => ({
    ...r,
    oldValues: sanitizeAuditValues(r.oldValues),
    newValues: sanitizeAuditValues(r.newValues),
  }))

  return {
    data: sanitizedRows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    meta: {
      entityTypes: filterOptions[0]?.entityTypes || [],
      actions: filterOptions[0]?.actions || [],
    },
  }
})
