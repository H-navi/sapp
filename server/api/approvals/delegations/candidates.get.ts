import { sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'approval.delegate', 'approval.act')
  const db = useDatabase()

  const currentEmployeeId = auth.employeeId || '00000000-0000-0000-0000-000000000000'

  // Ambil daftar pegawai aktif selain diri sendiri
  const employees = (await db.execute(sql`
    SELECT e.id,
           e.full_name,
           e.nip,
           d.name AS department_name,
           p.name AS position_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN positions p ON p.id = e.position_id
    WHERE e.is_active = TRUE
      AND e.id <> ${currentEmployeeId}::uuid
    ORDER BY e.full_name ASC
  `)) as any[]

  // Ambil jenis izin aktif
  const leaveTypes = (await db.execute(sql`
    SELECT id, code, name, color
    FROM leave_types
    WHERE is_active = TRUE
    ORDER BY name ASC
  `)) as any[]

  return {
    data: {
      employees: employees.map((e) => ({
        id: e.id,
        fullName: e.full_name,
        nip: e.nip,
        departmentName: e.department_name,
        positionName: e.position_name,
      })),
      leaveTypes: leaveTypes.map((lt) => ({
        id: lt.id,
        code: lt.code,
        name: lt.name,
        color: lt.color,
      })),
    },
  }
})
