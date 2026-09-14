import { pgTable, uuid, varchar, text, boolean, timestamp, smallint, date, numeric, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { escalationActionEnum, ruleTypeEnum, ruleViolationActionEnum } from './enums'
import { leaveTypes } from './leave-types'
import { users } from './auth'

export const leavePolicies = pgTable('leave_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => leaveTypes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  version: smallint('version').notNull().default(1),
  effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
  effectiveTo: date('effective_to'),
  overallDeadlineHours: numeric('overall_deadline_hours', { precision: 6, scale: 2 }).notNull().default('24.00'),
  deadlineUsesWorkingHours: boolean('deadline_uses_working_hours').notNull().default(true),
  onDeadlineAction: escalationActionEnum('on_deadline_action').notNull().default('AUTO_APPROVE'),
  autoDecisionRequiresRulePass: boolean('auto_decision_requires_rule_pass').notNull().default(true),
  autoRejectReasonTemplate: text('auto_reject_reason_template').notNull().default(
    'Pengajuan ditolak otomatis oleh sistem karena melewati batas waktu {{deadline_hours}} jam dan tidak memenuhi ketentuan: {{violated_rules}}'
  ),
  autoApproveReasonTemplate: text('auto_approve_reason_template').notNull().default(
    'Disetujui otomatis oleh sistem karena melewati batas waktu {{deadline_hours}} jam tanpa tindakan approver, dan seluruh ketentuan {{leave_type_name}} terpenuhi.'
  ),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leavePolicyRules = pgTable('leave_policy_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id').notNull().references(() => leavePolicies.id, { onDelete: 'cascade' }),
  ruleCode: varchar('rule_code', { length: 60 }).notNull(),
  ruleType: ruleTypeEnum('rule_type').notNull(),
  params: jsonb('params').notNull().default({}),
  violationAction: ruleViolationActionEnum('violation_action').notNull().default('BLOCK_SUBMIT'),
  messageTemplate: text('message_template').notNull(),
  evaluationOrder: smallint('evaluation_order').notNull().default(100),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
