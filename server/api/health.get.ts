import { sql } from 'drizzle-orm'
import { useDatabase } from '~~/server/database'

export default defineEventHandler(async () => {
  const db = useDatabase()
  const result = await db.execute(sql`
    SELECT now() AS waktu,
           (SELECT count(*)::int FROM employees)   AS pegawai,
           (SELECT count(*)::int FROM leave_types) AS jenis_izin
  `)
  return { data: { database: 'ok', ...(result[0] as Record<string, unknown>) } }
})
