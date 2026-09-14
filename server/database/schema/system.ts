import { pgTable, uuid, varchar, text, boolean, timestamp, smallint, date, time, jsonb, bigserial, integer } from 'drizzle-orm/pg-core'
import { auditActorEnum } from './enums'
import { users } from './auth'

export const workingHours = pgTable('working_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  dayOfWeek: smallint('day_of_week').notNull().unique(),
  isWorkingDay: boolean('is_working_day').notNull().default(true),
  startTime: time('start_time').notNull().default('08:00'),
  endTime: time('end_time').notNull().default('17:00'),
  breakStart: time('break_start'),
  breakEnd: time('break_end'),
})

export const holidays = pgTable('holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  holidayDate: date('holiday_date').notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('NATIONAL'),
  deductsQuota: boolean('deducts_quota').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  valueType: varchar('value_type', { length: 20 }).notNull().default('string'),
  groupName: varchar('group_name', { length: 40 }).notNull().default('general'),
  description: text('description'),
  isSecret: boolean('is_secret').notNull().default(false),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorType: auditActorEnum('actor_type').notNull().default('USER'),
  action: varchar('action', { length: 60 }).notNull(),
  entityType: varchar('entity_type', { length: 60 }).notNull(),
  entityId: uuid('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobExecutions = pgTable('job_executions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  jobName: varchar('job_name', { length: 60 }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('RUNNING'),
  processedCount: integer('processed_count').notNull().default(0),
  errorMessage: text('error_message'),
  details: jsonb('details').notNull().default({}),
})
