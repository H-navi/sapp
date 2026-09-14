import { randomBytes, randomInt } from 'node:crypto'
import { eq, and, sql, ilike, or, count, desc, asc } from 'drizzle-orm'
import { useDatabase, schema, type Database, type Transaction } from '../database'
import { withTransaction } from '../utils/transaction'
import { writeAuditLog } from '../utils/audit'
import { hashPassword } from '../utils/auth'
import type { EmployeeInput } from '../validators/employee'
import type { AuthContext } from '../utils/auth'

/** Cek agar manager_id tidak membentuk siklus (A -> B -> A). */
export async function assertNoManagerCycle(db: Database | Transaction, employeeId: string, managerId: string | null) {
  if (!managerId) return
  if (managerId === employeeId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ORG_CYCLE',
      message: 'Pegawai tidak bisa menjadi atasan dirinya sendiri.',
    })
  }

  let current: string | null = managerId
  for (let i = 0; i < 10 && current; i++) {
    if (current === employeeId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ORG_CYCLE',
        message: 'Susunan atasan membentuk lingkaran.',
      })
    }
    const [row] = await db
      .select({ managerId: schema.employees.managerId })
      .from(schema.employees)
      .where(eq(schema.employees.id, current))
      .limit(1)
    current = row?.managerId ?? null
  }
}

export async function listEmployees(query: {
  q?: string
  departmentId?: string
  isActive?: boolean
  page?: number
  perPage?: number
}) {
  const db = useDatabase()
  const page = query.page ?? 1
  const perPage = query.perPage ?? 20
  const offset = (page - 1) * perPage

  const conditions = []

  if (query.q) {
    const term = `%${query.q}%`
    conditions.push(
      or(
        ilike(schema.employees.fullName, term),
        ilike(schema.employees.nip, term),
        ilike(schema.employees.email, term)
      )
    )
  }

  if (query.departmentId) {
    conditions.push(eq(schema.employees.departmentId, query.departmentId))
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(schema.employees.isActive, query.isActive))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalRes] = await db
    .select({ total: count() })
    .from(schema.employees)
    .where(whereClause)

  const total = Number(totalRes?.total ?? 0)

  const items = await db
    .select({
      id: schema.employees.id,
      nip: schema.employees.nip,
      fullName: schema.employees.fullName,
      email: schema.employees.email,
      phone: schema.employees.phone,
      gender: schema.employees.gender,
      employmentStatus: schema.employees.employmentStatus,
      joinDate: schema.employees.joinDate,
      endDate: schema.employees.endDate,
      canSubmitRequest: schema.employees.canSubmitRequest,
      isActive: schema.employees.isActive,
      departmentId: schema.employees.departmentId,
      departmentName: schema.departments.name,
      positionId: schema.employees.positionId,
      positionName: schema.positions.name,
      positionLevel: schema.positions.level,
      managerId: schema.employees.managerId,
    })
    .from(schema.employees)
    .leftJoin(schema.departments, eq(schema.employees.departmentId, schema.departments.id))
    .leftJoin(schema.positions, eq(schema.employees.positionId, schema.positions.id))
    .where(whereClause)
    .orderBy(asc(schema.employees.fullName))
    .limit(perPage)
    .offset(offset)

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function getEmployee(id: string) {
  const db = useDatabase()

  const [emp] = await db
    .select({
      id: schema.employees.id,
      nip: schema.employees.nip,
      fullName: schema.employees.fullName,
      email: schema.employees.email,
      phone: schema.employees.phone,
      telegramChatId: schema.employees.telegramChatId,
      telegramUsername: schema.employees.telegramUsername,
      gender: schema.employees.gender,
      birthDate: schema.employees.birthDate,
      departmentId: schema.employees.departmentId,
      departmentName: schema.departments.name,
      positionId: schema.employees.positionId,
      positionName: schema.positions.name,
      positionLevel: schema.positions.level,
      managerId: schema.employees.managerId,
      employmentStatus: schema.employees.employmentStatus,
      joinDate: schema.employees.joinDate,
      endDate: schema.employees.endDate,
      canSubmitRequest: schema.employees.canSubmitRequest,
      photoUrl: schema.employees.photoUrl,
      isActive: schema.employees.isActive,
      createdAt: schema.employees.createdAt,
      updatedAt: schema.employees.updatedAt,
    })
    .from(schema.employees)
    .leftJoin(schema.departments, eq(schema.employees.departmentId, schema.departments.id))
    .leftJoin(schema.positions, eq(schema.employees.positionId, schema.positions.id))
    .where(eq(schema.employees.id, id))
    .limit(1)

  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Pegawai tidak ditemukan.' })
  }

  // Ambil data atasan jika ada
  let manager = null
  if (emp.managerId) {
    const [mgr] = await db
      .select({ id: schema.employees.id, fullName: schema.employees.fullName, nip: schema.employees.nip })
      .from(schema.employees)
      .where(eq(schema.employees.id, emp.managerId))
      .limit(1)
    manager = mgr ?? null
  }

  // Ambil data akun user & role
  const [user] = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      mustChangePassword: schema.users.mustChangePassword,
      isActive: schema.users.isActive,
      lastLoginAt: schema.users.lastLoginAt,
      failedLoginCount: schema.users.failedLoginCount,
      lockedUntil: schema.users.lockedUntil,
    })
    .from(schema.users)
    .where(eq(schema.users.employeeId, id))
    .limit(1)

  let roles: string[] = []
  if (user) {
    const roleRows = await db
      .select({ code: schema.roles.code })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, user.id))
    roles = roleRows.map((r) => r.code)
  }

  // Ambil ringkasan kuota tahun ini
  const currentYear = new Date().getFullYear()
  const quotas = await db
    .select({
      id: schema.leaveQuotas.id,
      leaveTypeId: schema.leaveQuotas.leaveTypeId,
      leaveTypeName: schema.leaveTypes.name,
      leaveTypeCode: schema.leaveTypes.code,
      periodYear: schema.leaveQuotas.periodYear,
      allocated: schema.leaveQuotas.allocated,
      carriedOver: schema.leaveQuotas.carriedOver,
      adjustment: schema.leaveQuotas.adjustment,
      reserved: schema.leaveQuotas.reserved,
      used: schema.leaveQuotas.used,
      balance: schema.leaveQuotas.balance,
    })
    .from(schema.leaveQuotas)
    .innerJoin(schema.leaveTypes, eq(schema.leaveQuotas.leaveTypeId, schema.leaveTypes.id))
    .where(
      and(
        eq(schema.leaveQuotas.employeeId, id),
        eq(schema.leaveQuotas.periodYear, currentYear)
      )
    )

  return {
    ...emp,
    manager,
    user: user ? { ...user, roles } : null,
    quotas,
  }
}

export async function createEmployee(input: EmployeeInput, actor: AuthContext) {
  const db = useDatabase()
  if (input.managerId) {
    await assertNoManagerCycle(db, 'new', input.managerId)
  }

  return withTransaction(async (tx) => {
    // 1. Insert employees
    const [emp] = await tx
      .insert(schema.employees)
      .values({
        nip: input.nip,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        gender: input.gender ?? null,
        birthDate: input.birthDate ?? null,
        departmentId: input.departmentId ?? null,
        positionId: input.positionId ?? null,
        managerId: input.managerId ?? null,
        employmentStatus: input.employmentStatus,
        joinDate: input.joinDate,
        endDate: input.endDate ?? null,
        canSubmitRequest: input.canSubmitRequest,
        telegramChatId: input.telegramChatId ?? null,
        isActive: input.isActive,
      })
      .returning()

    if (!emp) {
      throw createError({ statusCode: 500, statusMessage: 'INTERNAL_ERROR', message: 'Gagal membuat data pegawai.' })
    }

    // 2. Buat akun user otomatis
    let baseUsername = (input.email.split('@')[0] ?? 'user').toLowerCase().replace(/[^a-z0-9._]/g, '')
    if (baseUsername.length < 3) baseUsername = `user_${input.nip.toLowerCase()}`

    let username = baseUsername
    const [existing] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1)

    if (existing) {
      username = `${baseUsername}_${randomInt(100, 999)}`
    }

    const temporaryPassword = `Pass${randomBytes(4).toString('hex')}1!`
    const passwordHash = hashPassword(temporaryPassword)

    const [user] = await tx
      .insert(schema.users)
      .values({
        employeeId: emp.id,
        username,
        email: input.email,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
      })
      .returning()

    if (!user) {
      throw createError({ statusCode: 500, statusMessage: 'INTERNAL_ERROR', message: 'Gagal membuat akun user pegawai.' })
    }

    // 3. Assign role EMPLOYEE
    const [employeeRole] = await tx
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, 'EMPLOYEE'))
      .limit(1)

    if (employeeRole) {
      await tx.insert(schema.userRoles).values({
        userId: user.id,
        roleId: employeeRole.id,
        assignedBy: actor.userId,
      })
    }

    // 4. Inisialisasi kuota default tahun berjalan bila jenis izin memotong kuota
    const currentYear = new Date().getFullYear()
    const quotaLeaveTypes = await tx
      .select()
      .from(schema.leaveTypes)
      .where(and(eq(schema.leaveTypes.isActive, true), eq(schema.leaveTypes.deductsQuota, true)))

    for (const lt of quotaLeaveTypes) {
      const defaultAllocated = lt.defaultAnnualQuota ? String(lt.defaultAnnualQuota) : '0'
      await tx.insert(schema.leaveQuotas).values({
        employeeId: emp.id,
        leaveTypeId: lt.id,
        periodYear: currentYear,
        allocated: defaultAllocated,
        carriedOver: '0',
        adjustment: '0',
        reserved: '0',
        used: '0',
      })
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'CREATE_EMPLOYEE',
      entityType: 'employees',
      entityId: emp.id,
      newValues: { employee: emp, username },
    })

    return {
      employee: emp,
      temporaryPassword,
      username,
    }
  })
}

export async function updateEmployee(id: string, input: Partial<EmployeeInput>, actor: AuthContext) {
  const db = useDatabase()

  const [oldEmp] = await db.select().from(schema.employees).where(eq(schema.employees.id, id)).limit(1)
  if (!oldEmp) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Pegawai tidak ditemukan.' })
  }

  if (input.managerId !== undefined && input.managerId !== oldEmp.managerId) {
    await assertNoManagerCycle(db, id, input.managerId)
  }

  return withTransaction(async (tx) => {
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (input.nip !== undefined) updatePayload.nip = input.nip
    if (input.fullName !== undefined) updatePayload.fullName = input.fullName
    if (input.email !== undefined) updatePayload.email = input.email
    if (input.phone !== undefined) updatePayload.phone = input.phone
    if (input.gender !== undefined) updatePayload.gender = input.gender
    if (input.birthDate !== undefined) updatePayload.birthDate = input.birthDate
    if (input.departmentId !== undefined) updatePayload.departmentId = input.departmentId
    if (input.positionId !== undefined) updatePayload.positionId = input.positionId
    if (input.managerId !== undefined) updatePayload.managerId = input.managerId
    if (input.employmentStatus !== undefined) updatePayload.employmentStatus = input.employmentStatus
    if (input.joinDate !== undefined) updatePayload.joinDate = input.joinDate
    if (input.endDate !== undefined) updatePayload.endDate = input.endDate
    if (input.canSubmitRequest !== undefined) updatePayload.canSubmitRequest = input.canSubmitRequest
    if (input.telegramChatId !== undefined) updatePayload.telegramChatId = input.telegramChatId
    if (input.isActive !== undefined) updatePayload.isActive = input.isActive

    const [updatedEmp] = await tx
      .update(schema.employees)
      .set(updatePayload)
      .where(eq(schema.employees.id, id))
      .returning()

    // Jika email berubah, update juga email di tabel users
    if (input.email && input.email !== oldEmp.email) {
      await tx
        .update(schema.users)
        .set({ email: input.email })
        .where(eq(schema.users.employeeId, id))
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'employees',
      entityId: id,
      oldValues: oldEmp,
      newValues: updatedEmp,
    })

    return updatedEmp
  })
}

export async function deactivateEmployee(id: string, endDate: string, actor: AuthContext) {
  const db = useDatabase()

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, id)).limit(1)
  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Pegawai tidak ditemukan.' })
  }

  // Periksa apakah masih ada tugas approval berstatus PENDING
  const pendingTasks = await db
    .select({
      taskId: schema.approvalTasks.id,
      stepName: schema.approvalTasks.stepName,
      requestNumber: schema.leaveRequests.requestNumber,
      requesterName: schema.employees.fullName,
    })
    .from(schema.approvalTaskAssignees)
    .innerJoin(schema.approvalTasks, eq(schema.approvalTaskAssignees.taskId, schema.approvalTasks.id))
    .innerJoin(schema.leaveRequests, eq(schema.approvalTasks.requestId, schema.leaveRequests.id))
    .innerJoin(schema.employees, eq(schema.leaveRequests.employeeId, schema.employees.id))
    .where(
      and(
        eq(schema.approvalTaskAssignees.employeeId, id),
        eq(schema.approvalTasks.status, 'PENDING')
      )
    )

  return withTransaction(async (tx) => {
    // 1. Nonaktifkan pegawai
    await tx
      .update(schema.employees)
      .set({
        isActive: false,
        endDate,
        updatedAt: new Date(),
      })
      .where(eq(schema.employees.id, id))

    // 2. Nonaktifkan akun user dan cabut seluruh sesi aktif
    const [user] = await tx
      .update(schema.users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.employeeId, id))
      .returning({ id: schema.users.id })

    if (user) {
      await tx
        .update(schema.userSessions)
        .set({ revokedAt: new Date() })
        .where(eq(schema.userSessions.userId, user.id))
    }

    // 3. Batalkan pengajuan berstatus DRAFT milik pegawai
    await tx
      .update(schema.leaveRequests)
      .set({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Pegawai dinonaktifkan oleh admin',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.leaveRequests.employeeId, id),
          eq(schema.leaveRequests.status, 'DRAFT')
        )
      )

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'DEACTIVATE_EMPLOYEE',
      entityType: 'employees',
      entityId: id,
      oldValues: { isActive: true },
      newValues: { isActive: false, endDate },
    })

    return {
      success: true,
      pendingTasksWarning: pendingTasks.length > 0 ? pendingTasks : null,
    }
  })
}

export async function assignRoles(targetUserId: string, roleCodes: string[], actor: AuthContext) {
  const db = useDatabase()

  // Ambil user target
  const [targetUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1)

  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Pengguna tidak ditemukan.' })
  }

  // Cek Aturan 3: Admin tidak boleh mencabut role ADMIN miliknya sendiri
  if (actor.userId === targetUserId && !roleCodes.includes('ADMIN') && actor.roles.includes('ADMIN')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ADMIN_LOCKOUT_PROTECTION',
      message: 'Anda tidak dapat mencabut role ADMIN dari akun Anda sendiri.',
    })
  }

  // Cek Aturan 3: Sistem harus selalu menyisakan minimal satu user ADMIN aktif
  const currentRoles = await db
    .select({ code: schema.roles.code })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .where(eq(schema.userRoles.userId, targetUserId))

  const hadAdmin = currentRoles.some((r) => r.code === 'ADMIN')
  if (hadAdmin && !roleCodes.includes('ADMIN')) {
    const adminRole = await db.select().from(schema.roles).where(eq(schema.roles.code, 'ADMIN')).limit(1)
    if (adminRole[0]) {
      const activeAdminCount = await db
        .select({ count: count() })
        .from(schema.userRoles)
        .innerJoin(schema.users, eq(schema.userRoles.userId, schema.users.id))
        .where(
          and(
            eq(schema.userRoles.roleId, adminRole[0].id),
            eq(schema.users.isActive, true)
          )
        )

      if (Number(activeAdminCount[0]?.count ?? 0) <= 1) {
        throw createError({
          statusCode: 400,
          statusMessage: 'LAST_ADMIN_PROTECTION',
          message: 'Tidak dapat mencabut role ADMIN terakhir yang aktif di sistem.',
        })
      }
    }
  }

  // Dapatkan ID roles
  const validRoles = await db
    .select({ id: schema.roles.id, code: schema.roles.code })
    .from(schema.roles)
    .where(sql`${schema.roles.code} IN ${roleCodes}`)

  return withTransaction(async (tx) => {
    await tx.delete(schema.userRoles).where(eq(schema.userRoles.userId, targetUserId))

    for (const r of validRoles) {
      await tx.insert(schema.userRoles).values({
        userId: targetUserId,
        roleId: r.id,
        assignedBy: actor.userId,
      })
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'ASSIGN_ROLES',
      entityType: 'users',
      entityId: targetUserId,
      oldValues: currentRoles.map((r) => r.code),
      newValues: roleCodes,
    })

    return { ok: true, roles: roleCodes }
  })
}

export async function resetPassword(employeeId: string, actor: AuthContext) {
  const db = useDatabase()
  const [user] = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.employeeId, employeeId))
    .limit(1)

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND', message: 'Akun user untuk pegawai ini tidak ditemukan.' })
  }

  const temporaryPassword = `Reset${randomBytes(4).toString('hex')}9!`
  const passwordHash = hashPassword(temporaryPassword)

  return withTransaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({
        passwordHash,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id))

    // Cabut seluruh sesi aktif
    await tx
      .update(schema.userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.userSessions.userId, user.id))

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'RESET_PASSWORD',
      entityType: 'users',
      entityId: user.id,
    })

    return {
      username: user.username,
      temporaryPassword,
    }
  })
}
