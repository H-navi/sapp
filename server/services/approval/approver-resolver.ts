import { sql } from 'drizzle-orm'
import type { ApproverCandidate, RequestContext, WorkflowStepSnapshot } from './types'

/**
 * Cari kepala departemen, telusuri parent_id ke atas jika belum ada kepala departemen (maks 5 tingkat).
 */
async function cariKepalaDepartemen(tx: any, departmentId: string | null): Promise<string[]> {
  if (!departmentId) return []

  let currentDeptId: string | null = departmentId
  let depth = 0

  while (currentDeptId && depth < 5) {
    const rows = (await tx.execute(sql`
      SELECT id, head_employee_id, parent_id
      FROM departments
      WHERE id = ${currentDeptId}::uuid AND is_active = true
      LIMIT 1
    `)) as any[]

    if (rows.length === 0) break

    const dept = rows[0]
    if (dept.head_employee_id) {
      return [dept.head_employee_id]
    }

    currentDeptId = dept.parent_id ?? null
    depth++
  }

  return []
}

/**
 * Cari pegawai berdasarkan level posisi di departemen pemohon atau departemen induk (maks 5 tingkat).
 */
async function cariPegawaiByLevel(
  tx: any,
  targetLevel: number,
  departmentId: string | null
): Promise<string[]> {
  if (!departmentId) {
    // Cari secara global jika tidak terikat departemen
    const rows = (await tx.execute(sql`
      SELECT e.id
      FROM employees e
      JOIN positions p ON p.id = e.position_id
      WHERE p.level = ${targetLevel}::smallint
        AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
      LIMIT 10
    `)) as any[]
    return rows.map((r) => r.id)
  }

  let currentDeptId: string | null = departmentId
  let depth = 0

  while (currentDeptId && depth < 5) {
    const rows = (await tx.execute(sql`
      SELECT e.id
      FROM employees e
      JOIN positions p ON p.id = e.position_id
      WHERE e.department_id = ${currentDeptId}::uuid
        AND p.level = ${targetLevel}::smallint
        AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
      LIMIT 10
    `)) as any[]

    if (rows.length > 0) {
      return rows.map((r) => r.id)
    }

    const deptRows = (await tx.execute(sql`
      SELECT parent_id FROM departments WHERE id = ${currentDeptId}::uuid LIMIT 1
    `)) as any[]

    currentDeptId = deptRows[0]?.parent_id ?? null
    depth++
  }

  // Jika tetap kosong di hierarki cabang, coba cari level tertinggi secara global (misal Direktur level 5)
  const fallback = (await tx.execute(sql`
    SELECT e.id
    FROM employees e
    JOIN positions p ON p.id = e.position_id
    WHERE p.level = ${targetLevel}::smallint
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
    LIMIT 10
  `)) as any[]

  return fallback.map((r) => r.id)
}

/**
 * Cari pegawai berdasarkan ID posisi tertentu.
 */
async function cariPegawaiByPosition(tx: any, positionId: string): Promise<string[]> {
  const rows = (await tx.execute(sql`
    SELECT id
    FROM employees
    WHERE position_id = ${positionId}::uuid
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  `)) as any[]
  return rows.map((r) => r.id)
}

/**
 * Cari pegawai berdasarkan role akun (misal HR_APPROVER).
 */
async function cariPegawaiByRole(tx: any, roleId: string): Promise<string[]> {
  const rows = (await tx.execute(sql`
    SELECT DISTINCT u.employee_id AS id
    FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE ur.role_id = ${roleId}::uuid
      AND u.is_active = true
      AND u.employee_id IS NOT NULL
  `)) as any[]
  return rows.map((r) => r.id)
}

/**
 * Cari approver HR (role HR_APPROVER atau pegawai departemen HRD dengan hak approval).
 */
async function cariApproverHR(tx: any): Promise<string[]> {
  const rows = (await tx.execute(sql`
    SELECT DISTINCT u.employee_id AS id
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN users u ON u.id = ur.user_id
    WHERE (r.code = 'HR_APPROVER' OR r.code = 'ADMIN')
      AND u.is_active = true
      AND u.employee_id IS NOT NULL
  `)) as any[]
  return rows.map((r) => r.id)
}

/**
 * Saring hanya pegawai aktif yang memiliki akun aktif dan hak approval.act.
 */
async function saringApproverValid(tx: any, employeeIds: string[]): Promise<string[]> {
  if (employeeIds.length === 0) return []

  const rows = (await tx.execute(sql`
    SELECT DISTINCT e.id
    FROM employees e
    JOIN users u ON u.employee_id = e.id
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE e.id = ANY(ARRAY[${sql.join(employeeIds.map((id) => sql`${id}::uuid`), sql`, `)}])
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
      AND u.is_active = true
      AND p.code = 'approval.act'
  `)) as any[]

  return rows.map((r) => r.id)
}

/**
 * Ambil daftar approver yang sudah pernah menyetujui tahap sebelumnya pada pengajuan ini.
 */
async function approverTahapSebelumnya(tx: any, requestId: string): Promise<string[]> {
  const rows = (await tx.execute(sql`
    SELECT DISTINCT acted_by
    FROM approval_tasks
    WHERE request_id = ${requestId}::uuid
      AND status = 'APPROVED'
      AND acted_by IS NOT NULL
  `)) as any[]
  return rows.map((r) => r.acted_by)
}

/**
 * Cari delegasi wewenang yang aktif saat ini.
 */
async function cariDelegasiAktif(
  tx: any,
  delegatorEmployeeId: string,
  leaveTypeId: string
): Promise<Array<{ delegateEmployeeId: string }>> {
  const rows = (await tx.execute(sql`
    SELECT delegate_employee_id
    FROM approval_delegations
    WHERE delegator_employee_id = ${delegatorEmployeeId}::uuid
      AND is_active = true
      AND start_date <= CURRENT_DATE
      AND end_date >= CURRENT_DATE
      AND (leave_type_id IS NULL OR leave_type_id = ${leaveTypeId}::uuid)
  `)) as any[]

  return rows.map((r) => ({ delegateEmployeeId: r.delegate_employee_id }))
}

/**
 * Resolusi kandidat approver untuk satu tahap persetujuan.
 */
export async function resolveApprovers(
  tx: any,
  step: WorkflowStepSnapshot,
  request: RequestContext
): Promise<ApproverCandidate[]> {
  let utama: string[] = []

  switch (step.approverType) {
    case 'DIRECT_MANAGER':
      utama = request.employee.managerId ? [request.employee.managerId] : []
      break
    case 'DEPARTMENT_HEAD':
      utama = await cariKepalaDepartemen(tx, request.employee.departmentId)
      break
    case 'POSITION_LEVEL':
      utama = await cariPegawaiByLevel(tx, step.approverPositionLevel ?? 1, request.employee.departmentId)
      break
    case 'POSITION':
      utama = step.approverPositionId ? await cariPegawaiByPosition(tx, step.approverPositionId) : []
      break
    case 'SPECIFIC_EMPLOYEE':
      utama = step.approverEmployeeId ? [step.approverEmployeeId] : []
      break
    case 'ROLE':
      utama = step.approverRoleId ? await cariPegawaiByRole(tx, step.approverRoleId) : []
      break
    case 'HR_DEPARTMENT':
      utama = await cariApproverHR(tx)
      break
  }

  // Saring hanya approver valid yang aktif dan memiliki izin approval.act
  utama = await saringApproverValid(tx, utama)

  // Aturan pelewatan pemohon
  if (step.skipIfRequester) {
    utama = utama.filter((id) => id !== request.employee.id)
  }

  // Aturan pelewatan jika sudah menyetujui tahap sebelumnya
  if (step.skipIfAlreadyApproved) {
    const sudah = await approverTahapSebelumnya(tx, request.id)
    utama = utama.filter((id) => !sudah.includes(id))
  }

  // Bangun daftar kandidat approver utama
  const hasil: ApproverCandidate[] = utama.map((id) => ({
    employeeId: id,
    isDelegate: false,
    delegatedFrom: null,
  }))

  // Cek apakah approver utama sedang mendelegasikan wewenangnya
  if (step.allowDelegation) {
    for (const id of utama) {
      const delegasi = await cariDelegasiAktif(tx, id, request.leaveTypeId)
      for (const d of delegasi) {
        if (!hasil.some((h) => h.employeeId === d.delegateEmployeeId)) {
          hasil.push({
            employeeId: d.delegateEmployeeId,
            isDelegate: true,
            delegatedFrom: id,
          })
        }
      }
    }
  }

  return hasil
}
