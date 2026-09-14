import { eq, asc, desc } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { withTransaction } from '../utils/transaction'
import { writeAuditLog } from '../utils/audit'
import type { AuthContext } from '../utils/auth'

export async function listLeaveTypes() {
  const db = useDatabase()
  return db
    .select()
    .from(schema.leaveTypes)
    .orderBy(asc(schema.leaveTypes.sortOrder), asc(schema.leaveTypes.name))
}

export async function updateLeaveType(
  id: string,
  input: {
    name?: string
    description?: string | null
    defaultAnnualQuota?: number | null
    requiresAttachment?: boolean
    allowHalfDay?: boolean
    allowBackdate?: boolean
    maxBackdateDays?: number
    countsWorkingDaysOnly?: boolean
    color?: string
    icon?: string | null
    sortOrder?: number
    isActive?: boolean
  },
  actor: AuthContext
) {
  const db = useDatabase()
  const [oldLt] = await db.select().from(schema.leaveTypes).where(eq(schema.leaveTypes.id, id)).limit(1)
  if (!oldLt) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Jenis izin tidak ditemukan.' })
  }

  return withTransaction(async (tx) => {
    const payload: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    if (input.name !== undefined) payload.name = input.name
    if (input.description !== undefined) payload.description = input.description
    if (input.defaultAnnualQuota !== undefined) {
      payload.defaultAnnualQuota = input.defaultAnnualQuota != null ? String(input.defaultAnnualQuota) : null
    }
    if (input.requiresAttachment !== undefined) payload.requiresAttachment = input.requiresAttachment
    if (input.allowHalfDay !== undefined) payload.allowHalfDay = input.allowHalfDay
    if (input.allowBackdate !== undefined) payload.allowBackdate = input.allowBackdate
    if (input.maxBackdateDays !== undefined) payload.maxBackdateDays = input.maxBackdateDays
    if (input.countsWorkingDaysOnly !== undefined) payload.countsWorkingDaysOnly = input.countsWorkingDaysOnly
    if (input.color !== undefined) payload.color = input.color
    if (input.icon !== undefined) payload.icon = input.icon
    if (input.sortOrder !== undefined) payload.sortOrder = input.sortOrder
    if (input.isActive !== undefined) payload.isActive = input.isActive

    const [updated] = await tx
      .update(schema.leaveTypes)
      .set(payload)
      .where(eq(schema.leaveTypes.id, id))
      .returning()

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'UPDATE_LEAVE_TYPE',
      entityType: 'leave_types',
      entityId: id,
      oldValues: oldLt,
      newValues: updated,
    })

    return updated
  })
}

export async function listSystemSettings() {
  const db = useDatabase()
  return db.select().from(schema.systemSettings).orderBy(asc(schema.systemSettings.groupName), asc(schema.systemSettings.key))
}

export async function updateSystemSetting(key: string, value: unknown, actor: AuthContext) {
  const db = useDatabase()
  const [oldSetting] = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key)).limit(1)

  return withTransaction(async (tx) => {
    let updated
    if (oldSetting) {
      ;[updated] = await tx
        .update(schema.systemSettings)
        .set({
          value,
          updatedBy: actor.userId,
          updatedAt: new Date(),
        })
        .where(eq(schema.systemSettings.key, key))
        .returning()
    } else {
      ;[updated] = await tx
        .insert(schema.systemSettings)
        .values({
          key,
          value,
          updatedBy: actor.userId,
        })
        .returning()
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'UPDATE_SYSTEM_SETTING',
      entityType: 'system_settings',
      entityId: key,
      oldValues: oldSetting?.value,
      newValues: value,
    })

    return updated
  })
}

export async function listHolidays() {
  const db = useDatabase()
  return db.select().from(schema.holidays).orderBy(desc(schema.holidays.holidayDate))
}

export async function createHoliday(
  input: {
    holidayDate: string
    name: string
    type?: string
    deductsQuota?: boolean
  },
  actor: AuthContext
) {
  return withTransaction(async (tx) => {
    const [holiday] = await tx
      .insert(schema.holidays)
      .values({
        holidayDate: input.holidayDate,
        name: input.name,
        type: input.type ?? 'NATIONAL',
        deductsQuota: input.deductsQuota ?? false,
      })
      .returning()

    if (!holiday) {
      throw createError({ statusCode: 500, statusMessage: 'INTERNAL_ERROR', message: 'Gagal menambahkan hari libur.' })
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'CREATE_HOLIDAY',
      entityType: 'holidays',
      entityId: holiday.id,
      newValues: holiday,
    })

    return holiday
  })
}

export async function deleteHoliday(id: string, actor: AuthContext) {
  const db = useDatabase()
  const [old] = await db.select().from(schema.holidays).where(eq(schema.holidays.id, id)).limit(1)
  if (!old) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Hari libur tidak ditemukan.' })
  }

  return withTransaction(async (tx) => {
    await tx.delete(schema.holidays).where(eq(schema.holidays.id, id))

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'DELETE_HOLIDAY',
      entityType: 'holidays',
      entityId: id,
      oldValues: old,
    })

    return { ok: true }
  })
}

export async function listWorkingHours() {
  const db = useDatabase()
  return db.select().from(schema.workingHours).orderBy(asc(schema.workingHours.dayOfWeek))
}

export async function updateWorkingHour(
  dayOfWeek: number,
  input: {
    isWorkingDay: boolean
    startTime: string
    endTime: string
    breakStart?: string | null
    breakEnd?: string | null
  },
  actor: AuthContext
) {
  const db = useDatabase()
  const [old] = await db.select().from(schema.workingHours).where(eq(schema.workingHours.dayOfWeek, dayOfWeek)).limit(1)

  return withTransaction(async (tx) => {
    let updated
    if (old) {
      ;[updated] = await tx
        .update(schema.workingHours)
        .set({
          isWorkingDay: input.isWorkingDay,
          startTime: input.startTime,
          endTime: input.endTime,
          breakStart: input.breakStart ?? null,
          breakEnd: input.breakEnd ?? null,
        })
        .where(eq(schema.workingHours.dayOfWeek, dayOfWeek))
        .returning()
    } else {
      ;[updated] = await tx
        .insert(schema.workingHours)
        .values({
          dayOfWeek,
          isWorkingDay: input.isWorkingDay,
          startTime: input.startTime,
          endTime: input.endTime,
          breakStart: input.breakStart ?? null,
          breakEnd: input.breakEnd ?? null,
        })
        .returning()
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'UPDATE_WORKING_HOUR',
      entityType: 'working_hours',
      entityId: String(dayOfWeek),
      oldValues: old,
      newValues: updated,
    })

    return updated
  })
}
