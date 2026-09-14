import { schema } from '../database'
import type { Transaction } from '../database'

export async function writeAuditLog(tx: Transaction, input: {
  actorUserId?: string | null
  actorType?: 'USER' | 'SYSTEM' | 'ADMIN'
  action: string
  entityType: string
  entityId?: string | null
  oldValues?: unknown
  newValues?: unknown
  ipAddress?: string | null
  userAgent?: string | null
}) {
  await tx.insert(schema.auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType ?? 'USER',
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    oldValues: input.oldValues ?? null,
    newValues: input.newValues ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  })
}
