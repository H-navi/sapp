import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  console.log('Running migration 04_add_telegram_to_users...')
  try {
    await sql`
      ALTER TABLE auth.users
        ADD COLUMN IF NOT EXISTS telegram_chat_id varchar(50),
        ADD COLUMN IF NOT EXISTS telegram_username varchar(60);
    `
    await sql`
      UPDATE auth.users u
      SET telegram_chat_id = e.telegram_chat_id,
          telegram_username = e.telegram_username
      FROM org.employees e
      WHERE u.employee_id = e.id
        AND e.telegram_chat_id IS NOT NULL;
    `
    console.log('Migration 04 completed successfully!')
  } finally {
    await sql.end({ timeout: 1 })
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
