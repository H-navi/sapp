import { eq, and, asc } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { withTransaction } from '../utils/transaction'
import { writeAuditLog } from '../utils/audit'
import type { AuthContext } from '../utils/auth'

export async function getAllowedLeaveTypes(employeeId: string) {
  const db = useDatabase()

  // 1. Ambil data pegawai
  const [emp] = await db
    .select({
      id: schema.employees.id,
      canSubmitRequest: schema.employees.canSubmitRequest,
      departmentId: schema.employees.departmentId,
      positionId: schema.employees.positionId,
      employmentStatus: schema.employees.employmentStatus,
      gender: schema.employees.gender,
      isActive: schema.employees.isActive,
    })
    .from(schema.employees)
    .where(eq(schema.employees.id, employeeId))
    .limit(1)

  if (!emp || !emp.isActive || !emp.canSubmitRequest) {
    return []
  }

  // 2. Ambil seluruh jenis izin aktif
  const leaveTypes = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.isActive, true))
    .orderBy(asc(schema.leaveTypes.sortOrder), asc(schema.leaveTypes.name))

  // 3. Ambil seluruh baris eligibility
  const eligibilities = await db.select().from(schema.leaveTypeEligibilities)

  const allowedTypes = []

  for (const lt of leaveTypes) {
    // Cek batasan gender langsung jika ada
    if (lt.genderRestriction && emp.gender && lt.genderRestriction !== emp.gender) {
      continue
    }

    const typeRules = eligibilities.filter((r) => r.leaveTypeId === lt.id)

    // Aturan 2: Baris dengan employee_id cocok mengalahkan aturan umum
    const employeeOverride = typeRules.find((r) => r.employeeId === emp.id)
    if (employeeOverride) {
      if (employeeOverride.isAllowed) {
        allowedTypes.push(lt)
      }
      continue
    }

    // Aturan 3: Ada baris department_id / position_id / employment_status cocok dan is_allowed = false -> tolak
    const isRestricted = typeRules.some((r) => {
      if (r.isAllowed) return false
      if (r.departmentId && r.departmentId === emp.departmentId) return true
      if (r.positionId && r.positionId === emp.positionId) return true
      if (r.employmentStatus && r.employmentStatus === emp.employmentStatus) return true
      return false
    })

    if (isRestricted) {
      continue
    }

    // Aturan 4: Selain itu -> izinkan
    allowedTypes.push(lt)
  }

  return allowedTypes
}

export async function getLeaveTypeEligibilities(leaveTypeId: string) {
  const db = useDatabase()
  return db
    .select({
      id: schema.leaveTypeEligibilities.id,
      leaveTypeId: schema.leaveTypeEligibilities.leaveTypeId,
      employeeId: schema.leaveTypeEligibilities.employeeId,
      employeeName: schema.employees.fullName,
      employeeNip: schema.employees.nip,
      departmentId: schema.leaveTypeEligibilities.departmentId,
      departmentName: schema.departments.name,
      positionId: schema.leaveTypeEligibilities.positionId,
      positionName: schema.positions.name,
      employmentStatus: schema.leaveTypeEligibilities.employmentStatus,
      isAllowed: schema.leaveTypeEligibilities.isAllowed,
      note: schema.leaveTypeEligibilities.note,
      createdAt: schema.leaveTypeEligibilities.createdAt,
    })
    .from(schema.leaveTypeEligibilities)
    .leftJoin(schema.employees, eq(schema.leaveTypeEligibilities.employeeId, schema.employees.id))
    .leftJoin(schema.departments, eq(schema.leaveTypeEligibilities.departmentId, schema.departments.id))
    .leftJoin(schema.positions, eq(schema.leaveTypeEligibilities.positionId, schema.positions.id))
    .where(eq(schema.leaveTypeEligibilities.leaveTypeId, leaveTypeId))
}

export async function saveLeaveTypeEligibilities(
  leaveTypeId: string,
  rules: Array<{
    employeeId?: string | null
    departmentId?: string | null
    positionId?: string | null
    employmentStatus?: 'PERMANENT' | 'CONTRACT' | 'PROBATION' | 'INTERN' | 'OUTSOURCE' | null
    isAllowed: boolean
    note?: string | null
  }>,
  actor: AuthContext
) {
  const db = useDatabase()
  const oldRules = await db
    .select()
    .from(schema.leaveTypeEligibilities)
    .where(eq(schema.leaveTypeEligibilities.leaveTypeId, leaveTypeId))

  return withTransaction(async (tx) => {
    await tx
      .delete(schema.leaveTypeEligibilities)
      .where(eq(schema.leaveTypeEligibilities.leaveTypeId, leaveTypeId))

    if (rules.length > 0) {
      await tx.insert(schema.leaveTypeEligibilities).values(
        rules.map((r) => ({
          leaveTypeId,
          employeeId: r.employeeId ?? null,
          departmentId: r.departmentId ?? null,
          positionId: r.positionId ?? null,
          employmentStatus: r.employmentStatus ?? null,
          isAllowed: r.isAllowed,
          note: r.note ?? null,
          createdBy: actor.userId,
        }))
      )
    }

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'SAVE_LEAVE_TYPE_ELIGIBILITY',
      entityType: 'leave_types',
      entityId: leaveTypeId,
      oldValues: oldRules,
      newValues: rules,
    })

    return { ok: true }
  })
}
