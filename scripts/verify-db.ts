import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

const checks = [
  { label: 'tabel',            query: sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`, expect: 36 },
  { label: 'jenis izin',       query: sql`SELECT count(*)::int AS n FROM leave_types`,              expect: 6 },
  { label: 'aturan',           query: sql`SELECT count(*)::int AS n FROM leave_policy_rules`,       expect: 32 },
  { label: 'tahap approval',   query: sql`SELECT count(*)::int AS n FROM approval_workflow_steps`,  expect: 18 },
  { label: 'template notif',   query: sql`SELECT count(*)::int AS n FROM notification_templates`,   expect: 14 },
]

let gagal = 0
try {
  for (const c of checks) {
    const [row] = await c.query
    const ok = row?.n === c.expect
    if (!ok) gagal++
    console.log(`${ok ? 'OK  ' : 'GAGAL'} ${c.label}: ${row?.n} (harapan ${c.expect})`)
  }
} catch (err) {
  console.error('Koneksi database gagal saat menjalankan verify-db:', err)
  gagal++
} finally {
  await sql.end({ timeout: 1 })
}
process.exit(gagal ? 1 : 0)
