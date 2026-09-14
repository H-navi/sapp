import { pgTable, uuid, varchar, text, boolean, timestamp, smallint, time, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { notificationEventEnum, notificationChannelEnum, notificationStatusEnum } from './enums'
import { leaveTypes } from './leave-types'
import { approvalWorkflowSteps } from './workflows'
import { employees } from './org'
import { users } from './auth'
import { leaveRequests } from './requests'
import { approvalTasks } from './approvals'

export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  eventType: notificationEventEnum('event_type').notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  targetAudience: varchar('target_audience', { length: 20 }).notNull().default('APPROVER'),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'cascade' }),
  workflowStepId: uuid('workflow_step_id').references(() => approvalWorkflowSteps.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 10 }).notNull().default('id-ID'),
  subjectTemplate: text('subject_template'),
  bodyTemplate: text('body_template').notNull(),
  parseMode: varchar('parse_mode', { length: 20 }).notNull().default('HTML'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notificationTemplateVariables = pgTable('notification_template_variables', {
  id: uuid('id').primaryKey().defaultRandom(),
  variableKey: varchar('variable_key', { length: 60 }).notNull().unique(),
  description: text('description').notNull(),
  exampleValue: text('example_value'),
  appliesTo: notificationEventEnum('applies_to').array().notNull().default(sql`'{}'::notification_event_enum[]`),
  sortOrder: smallint('sort_order').notNull().default(0),
})

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  channel: notificationChannelEnum('channel').notNull(),
  eventType: notificationEventEnum('event_type'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  quietHoursStart: time('quiet_hours_start'),
  quietHoursEnd: time('quiet_hours_end'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => notificationTemplates.id, { onDelete: 'set null' }),
  eventType: notificationEventEnum('event_type').notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  recipientEmployeeId: uuid('recipient_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  recipientAddress: varchar('recipient_address', { length: 255 }).notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  status: notificationStatusEnum('status').notNull().default('QUEUED'),
  attemptCount: smallint('attempt_count').notNull().default(0),
  maxAttempts: smallint('max_attempts').notNull().default(3),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  providerMessageId: varchar('provider_message_id', { length: 150 }),
  requestId: uuid('request_id').references(() => leaveRequests.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => approvalTasks.id, { onDelete: 'cascade' }),
  dedupeKey: varchar('dedupe_key', { length: 180 }),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const inAppNotifications = pgTable('in_app_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body'),
  url: text('url'),
  eventType: notificationEventEnum('event_type'),
  requestId: uuid('request_id').references(() => leaveRequests.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
