import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let client: ReturnType<typeof postgres> | undefined
let database: PostgresJsDatabase<typeof schema> | undefined

export function useDatabase(): PostgresJsDatabase<typeof schema> {
  if (!database) {
    let dbUrl: string | undefined = process.env.DATABASE_URL
    try {
      // @ts-ignore
      if (typeof useRuntimeConfig === 'function') {
        const config = useRuntimeConfig()
        if (config?.databaseUrl) dbUrl = config.databaseUrl as string
      }
    } catch {
      // ignore
    }

    if (!dbUrl) {
      throw new Error('DATABASE_URL belum dikonfigurasi')
    }
    client = postgres(dbUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      types: {
        // jaga presisi numeric: kembalikan sebagai string, konversi eksplisit di service
        bigint: postgres.BigInt,
      },
      onnotice: () => {},
    })
    database = drizzle(client, { schema, casing: 'snake_case', logger: process.env.NODE_ENV === 'development' && process.env.NODE_ENV !== 'test' })
  }
  return database
}

export type Database = PostgresJsDatabase<typeof schema>
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
export { schema }
