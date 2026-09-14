import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema/*.ts',
  out: './server/database/introspect',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: 'snake_case',
  schemaFilter: ['auth', 'org', 'leaves', 'approvals', 'notifications', 'system', 'public'],
  verbose: true,
  strict: true,
})
