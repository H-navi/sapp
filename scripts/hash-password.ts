import bcrypt from 'bcryptjs'

const password = process.argv[2]
if (!password) {
  console.error('Pemakaian: npx tsx scripts/hash-password.ts "<password>"')
  process.exit(1)
}
const hash = bcrypt.hashSync(password, 12)
console.log(hash)
console.log('\nJalankan di psql:')
console.log(`UPDATE users SET password_hash = '${hash}';`)
