import { pgTable, uuid, text, timestamp, smallint, date, numeric, bigserial } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { quotaTxnEnum } from './enums'
import { employees } from './org'
import { leaveTypes } from './leave-types'
import { users } from './auth'

export const leaveQuotas = pgTable('leave_quotas', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => leaveTypes.id, { onDelete: 'cascade' }),
  periodYear: smallint('period_year').notNull(),
  allocated: numeric('allocated', { precision: 6, scale: 1 }).notNull().default('0'),
  carriedOver: numeric('carried_over', { precision: 6, scale: 1 }).notNull().default('0'),
  adjustment: numeric('adjustment', { precision: 6, scale: 1 }).notNull().default('0'),
  reserved: numeric('reserved', { precision: 6, scale: 1 }).notNull().default('0'),
  used: numeric('used', { precision: 6, scale: 1 }).notNull().default('0'),
  balance: numeric('balance', { precision: 6, scale: 1 }).generatedAlwaysAs(
    (): ReturnType<typeof sql> => sql`allocated + carried_over + adjustment - reserved - used`
  ),
  carryOverExpiresAt: date('carry_over_expires_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leaveQuotaLedger = pgTable('leave_quota_ledger', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  quotaId: uuid('quota_id').notNull().references(() => leaveQuotas.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id'),
  txnType: quotaTxnEnum('txn_type').notNull(),
  amount: numeric('amount', { precision: 6, scale: 1 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 6, scale: 1 }).notNull(),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
