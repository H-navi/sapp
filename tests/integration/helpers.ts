import { eq, and, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../server/database'
import type { AuthContext } from '../../server/utils/auth'

export interface TestFixtures {
  budi: any // EMP006 Staff IT
  andi: any // EMP005 SPV IT (atasan Budi)
  rina: any // EMP004 MGR IT (kepala divisi IT)
  joko: any // EMP002 MGR HRD
  admin: any // Admin user
  cutiTahunan: any
  wfa: any
  izinTidakMasuk: any
  sakit: any
}

export async function getFixtures(): Promise<TestFixtures> {
  const db = useDatabase()

  const [budiUser] = await db
    .select({ employee: schema.employees, user: schema.users })
    .from(schema.employees)
    .innerJoin(schema.users, eq(schema.users.employeeId, schema.employees.id))
    .where(eq(schema.employees.nip, 'EMP006'))
    .limit(1)

  const [andiUser] = await db
    .select({ employee: schema.employees, user: schema.users })
    .from(schema.employees)
    .innerJoin(schema.users, eq(schema.users.employeeId, schema.employees.id))
    .where(eq(schema.employees.nip, 'EMP005'))
    .limit(1)

  const [rinaUser] = await db
    .select({ employee: schema.employees, user: schema.users })
    .from(schema.employees)
    .innerJoin(schema.users, eq(schema.users.employeeId, schema.employees.id))
    .where(eq(schema.employees.nip, 'EMP004'))
    .limit(1)

  const [jokoUser] = await db
    .select({ employee: schema.employees, user: schema.users })
    .from(schema.employees)
    .innerJoin(schema.users, eq(schema.users.employeeId, schema.employees.id))
    .where(eq(schema.employees.nip, 'EMP002'))
    .limit(1)

  const [adminUser] = await db.select().from(schema.users).where(eq(schema.users.username, 'admin')).limit(1)

  const [cutiTahunan] = await db.select().from(schema.leaveTypes).where(eq(schema.leaveTypes.code, 'CUTI_TAHUNAN')).limit(1)
  const [wfa] = await db.select().from(schema.leaveTypes).where(eq(schema.leaveTypes.code, 'WFA')).limit(1)
  const [izinTidakMasuk] = await db.select().from(schema.leaveTypes).where(eq(schema.leaveTypes.code, 'IZIN_TIDAK_MASUK')).limit(1)
  const [sakit] = await db.select().from(schema.leaveTypes).where(eq(schema.leaveTypes.code, 'SAKIT')).limit(1)

  return {
    budi: { ...budiUser.employee, userId: budiUser.user.id },
    andi: { ...andiUser.employee, userId: andiUser.user.id },
    rina: { ...rinaUser.employee, userId: rinaUser.user.id },
    joko: { ...jokoUser.employee, userId: jokoUser.user.id },
    admin: adminUser,
    cutiTahunan,
    wfa,
    izinTidakMasuk,
    sakit,
  }
}

export function makeAuth(employee: any, roles: string[] = ['EMPLOYEE'], permissions: string[] = ['request.create', 'request.view.own']): AuthContext {
  return {
    userId: employee.userId || employee.id,
    username: employee.nip || 'test_user',
    employeeId: employee.id,
    roles,
    permissions,
  }
}

export async function cleanupRequest(requestId?: string | null) {
  if (!requestId) return
  const db = useDatabase()

  // Ambil data pengajuan untuk mengembalikan kuota jika pernah terpotong/reserved
  const [req] = await db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, requestId)).limit(1)
  if (req) {
    const year = new Date(req.startDate).getFullYear()
    // Reset reserved dan used kembali normal jika ada
    await db.execute(sql`
      UPDATE leave_quotas
      SET allocated = '12', reserved = '0', used = '0', updated_at = NOW()
      WHERE employee_id = ${req.employeeId}::uuid
        AND leave_type_id = ${req.leaveTypeId}::uuid
        AND period_year = ${year}::smallint
    `)

    // Hapus ledger terkait
    await db.execute(sql`DELETE FROM leave_quota_ledger WHERE request_id = ${requestId}::uuid`)

    // Hapus leave_requests (cascade ke leave_request_days, approval_tasks, approval_task_assignees, approval_histories, dll)
    await db.delete(schema.leaveRequests).where(eq(schema.leaveRequests.id, requestId))
  }
}
