import { eq, asc } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { withTransaction } from '../utils/transaction'
import { writeAuditLog } from '../utils/audit'
import type { AuthContext } from '../utils/auth'

export async function listDepartments() {
  const db = useDatabase()
  return db
    .select({
      id: schema.departments.id,
      code: schema.departments.code,
      name: schema.departments.name,
      parentId: schema.departments.parentId,
      headEmployeeId: schema.departments.headEmployeeId,
      isActive: schema.departments.isActive,
      headEmployeeName: schema.employees.fullName,
      createdAt: schema.departments.createdAt,
      updatedAt: schema.departments.updatedAt,
    })
    .from(schema.departments)
    .leftJoin(schema.employees, eq(schema.departments.headEmployeeId, schema.employees.id))
    .orderBy(asc(schema.departments.name))
}

export async function createDepartment(input: {
  code: string
  name: string
  parentId?: string | null
  headEmployeeId?: string | null
  isActive?: boolean
}, actor: AuthContext) {
  return withTransaction(async (tx) => {
    const [dept] = await tx
      .insert(schema.departments)
      .values({
        code: input.code,
        name: input.name,
        parentId: input.parentId ?? null,
        headEmployeeId: input.headEmployeeId ?? null,
        isActive: input.isActive ?? true,
      })
      .returning()

    if (!dept) {
      throw createError({ statusCode: 500, statusMessage: 'INTERNAL_ERROR', message: 'Gagal membuat departemen.' })
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'CREATE_DEPARTMENT',
      entityType: 'departments',
      entityId: dept.id,
      newValues: dept,
    })

    return dept
  })
}

export async function updateDepartment(id: string, input: {
  code?: string
  name?: string
  parentId?: string | null
  headEmployeeId?: string | null
  isActive?: boolean
}, actor: AuthContext) {
  const db = useDatabase()
  const [oldDept] = await db.select().from(schema.departments).where(eq(schema.departments.id, id)).limit(1)
  if (!oldDept) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Departemen tidak ditemukan.' })
  }

  return withTransaction(async (tx) => {
    const [updated] = await tx
      .update(schema.departments)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(schema.departments.id, id))
      .returning()

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'UPDATE_DEPARTMENT',
      entityType: 'departments',
      entityId: id,
      oldValues: oldDept,
      newValues: updated,
    })

    return updated
  })
}

export async function listPositions() {
  const db = useDatabase()
  return db
    .select()
    .from(schema.positions)
    .orderBy(asc(schema.positions.level), asc(schema.positions.name))
}

export async function createPosition(input: {
  code: string
  name: string
  level: number
  isActive?: boolean
}, actor: AuthContext) {
  return withTransaction(async (tx) => {
    const [pos] = await tx
      .insert(schema.positions)
      .values({
        code: input.code,
        name: input.name,
        level: input.level,
        isActive: input.isActive ?? true,
      })
      .returning()

    if (!pos) {
      throw createError({ statusCode: 500, statusMessage: 'INTERNAL_ERROR', message: 'Gagal membuat jabatan.' })
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'CREATE_POSITION',
      entityType: 'positions',
      entityId: pos.id,
      newValues: pos,
    })

    return pos
  })
}

export async function updatePosition(id: string, input: {
  code?: string
  name?: string
  level?: number
  isActive?: boolean
}, actor: AuthContext) {
  const db = useDatabase()
  const [oldPos] = await db.select().from(schema.positions).where(eq(schema.positions.id, id)).limit(1)
  if (!oldPos) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Jabatan tidak ditemukan.' })
  }

  return withTransaction(async (tx) => {
    const [updated] = await tx
      .update(schema.positions)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(schema.positions.id, id))
      .returning()

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'UPDATE_POSITION',
      entityType: 'positions',
      entityId: id,
      oldValues: oldPos,
      newValues: updated,
    })

    return updated
  })
}
