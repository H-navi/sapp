import { useDatabase, type Database, type Transaction } from '../database'

/**
 * Menjalankan fn di dalam satu transaksi.
 * Semua service yang menulis lebih dari satu tabel WAJIB memakai helper ini.
 */
export async function withTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const db: Database = useDatabase()
  return db.transaction(async (tx) => fn(tx))
}
