import { pgTable, uuid, varchar, text, boolean, timestamp, smallint, jsonb, bigserial, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { approvalModeEnum, approvalTaskStatusEnum, actionSourceEnum, auditActorEnum, requestStatusEnum } from './enums'
import { leaveRequests } from './requests'
import { approvalWorkflowSteps } from './workflows'
import { employees } from './org'

export const approvalTasks = pgTable('approval_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  workflowStepId: uuid('workflow_step_id').references(() => approvalWorkflowSteps.id, { onDelete: 'set null' }),
  stepOrder: smallint('step_order').notNull(),
  stepName: varchar('step_name', { length: 100 }).notNull(),
  approvalMode: approvalModeEnum('approval_mode').notNull().default('ANY_ONE'),
  quorumCount: smallint('quorum_count'),
  status: approvalTaskStatusEnum('status').notNull().default('WAITING'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  actedAt: timestamp('acted_at', { withTimezone: true }),
  actedBy: uuid('acted_by').references(() => employees.id, { onDelete: 'set null' }),
  actionSource: actionSourceEnum('action_source'),
  actionNote: text('action_note'),
  reminderCount: smallint('reminder_count').notNull().default(0),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  nextReminderAt: timestamp('next_reminder_at', { withTimezone: true }),
  escalatedFromTaskId: uuid('escalated_from_task_id').references((): AnyPgColumn => approvalTasks.id, { onDelete: 'set null' }),
  stepSnapshot: jsonb('step_snapshot'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const approvalTaskAssignees = pgTable('approval_task_assignees', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => approvalTasks.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  isDelegate: boolean('is_delegate').notNull().default(false),
  delegatedFrom: uuid('delegated_from').references(() => employees.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  firstViewedAt: timestamp('first_viewed_at', { withTimezone: true }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  response: approvalTaskStatusEnum('response'),
  responseNote: text('response_note'),
})

export const approvalHistories = pgTable('approval_histories', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  requestId: uuid('request_id').notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => approvalTasks.id, { onDelete: 'set null' }),
  stepOrder: smallint('step_order'),
  stepName: varchar('step_name', { length: 100 }),
  actorEmployeeId: uuid('actor_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  actorType: auditActorEnum('actor_type').notNull().default('USER'),
  action: varchar('action', { length: 40 }).notNull(),
  fromStatus: requestStatusEnum('from_status'),
  toStatus: requestStatusEnum('to_status'),
  note: text('note'),
  reason: text('reason'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
