import { pgTable, uuid, varchar, text, boolean, timestamp, smallint, date, numeric, integer, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { employmentStatusEnum, approverTypeEnum, approvalModeEnum, notificationChannelEnum, escalationActionEnum } from './enums'
import { leaveTypes } from './leave-types'
import { departments, positions, employees } from './org'
import { roles, users } from './auth'

export const approvalWorkflows = pgTable('approval_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'cascade' }),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }),
  positionLevelMin: smallint('position_level_min'),
  positionLevelMax: smallint('position_level_max'),
  employmentStatus: employmentStatusEnum('employment_status'),
  minDays: numeric('min_days', { precision: 5, scale: 1 }),
  maxDays: numeric('max_days', { precision: 5, scale: 1 }),
  priority: smallint('priority').notNull().default(100),
  version: smallint('version').notNull().default(1),
  effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
  effectiveTo: date('effective_to'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const approvalWorkflowSteps = pgTable('approval_workflow_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').notNull().references(() => approvalWorkflows.id, { onDelete: 'cascade' }),
  stepOrder: smallint('step_order').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  approverType: approverTypeEnum('approver_type').notNull(),
  approverPositionId: uuid('approver_position_id').references(() => positions.id, { onDelete: 'set null' }),
  approverPositionLevel: smallint('approver_position_level'),
  approverEmployeeId: uuid('approver_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  approverRoleId: uuid('approver_role_id').references(() => roles.id, { onDelete: 'set null' }),
  approvalMode: approvalModeEnum('approval_mode').notNull().default('ANY_ONE'),
  quorumCount: smallint('quorum_count'),
  isOptional: boolean('is_optional').notNull().default(false),
  skipIfRequester: boolean('skip_if_requester').notNull().default(true),
  skipIfAlreadyApproved: boolean('skip_if_already_approved').notNull().default(true),
  conditionMinDays: numeric('condition_min_days', { precision: 5, scale: 1 }),
  conditionExpression: jsonb('condition_expression'),
  slaHours: numeric('sla_hours', { precision: 6, scale: 2 }).notNull().default('8.00'),
  slaUsesWorkingHours: boolean('sla_uses_working_hours').notNull().default(true),
  reminderEnabled: boolean('reminder_enabled').notNull().default(true),
  reminderIntervalMinutes: integer('reminder_interval_minutes').notNull().default(120),
  reminderMaxCount: smallint('reminder_max_count').notNull().default(5),
  reminderOnlyWorkingHours: boolean('reminder_only_working_hours').notNull().default(true),
  reminderChannels: notificationChannelEnum('reminder_channels').array().notNull().default(sql`'{EMAIL,TELEGRAM}'::notification_channel_enum[]`),
  escalationAction: escalationActionEnum('escalation_action').notNull().default('AUTO_APPROVE'),
  escalateToStepOrder: smallint('escalate_to_step_order'),
  escalationNotifyAdmin: boolean('escalation_notify_admin').notNull().default(true),
  allowDelegation: boolean('allow_delegation').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const approvalDelegations = pgTable('approval_delegations', {
  id: uuid('id').primaryKey().defaultRandom(),
  delegatorEmployeeId: uuid('delegator_employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  delegateEmployeeId: uuid('delegate_employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'cascade' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: text('reason'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
