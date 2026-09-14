import { pgTable, uuid, varchar, text, boolean, timestamp, smallint, date, numeric, bigint, jsonb, bigserial } from 'drizzle-orm/pg-core'
import { dayPartEnum, requestStatusEnum, actionSourceEnum, ruleTypeEnum, ruleViolationActionEnum } from './enums'
import { employees } from './org'
import { leaveTypes } from './leave-types'
import { leavePolicies, leavePolicyRules } from './policies'
import { approvalWorkflows } from './workflows'
import { users } from './auth'

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestNumber: varchar('request_number', { length: 30 }).notNull(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'restrict' }),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => leaveTypes.id, { onDelete: 'restrict' }),
  policyId: uuid('policy_id').references(() => leavePolicies.id, { onDelete: 'set null' }),
  workflowId: uuid('workflow_id').references(() => approvalWorkflows.id, { onDelete: 'set null' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  startDayPart: dayPartEnum('start_day_part').notNull().default('FULL_DAY'),
  endDayPart: dayPartEnum('end_day_part').notNull().default('FULL_DAY'),
  totalDays: numeric('total_days', { precision: 5, scale: 1 }).notNull(),
  workingDays: numeric('working_days', { precision: 5, scale: 1 }).notNull(),
  reason: text('reason').notNull(),
  addressDuringLeave: text('address_during_leave'),
  contactPhone: varchar('contact_phone', { length: 30 }),
  delegateEmployeeId: uuid('delegate_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  status: requestStatusEnum('status').notNull().default('DRAFT'),
  currentStepOrder: smallint('current_step_order'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  finalDeadlineAt: timestamp('final_deadline_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedBy: uuid('decided_by').references(() => employees.id, { onDelete: 'set null' }),
  decisionSource: actionSourceEnum('decision_source'),
  decisionReason: text('decision_reason'),
  isAutoDecided: boolean('is_auto_decided').notNull().default(false),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  ruleCheckPassed: boolean('rule_check_passed'),
  ruleCheckResult: jsonb('rule_check_result'),
  policySnapshot: jsonb('policy_snapshot'),
  workflowSnapshot: jsonb('workflow_snapshot'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leaveRequestDays = pgTable('leave_request_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  leaveDate: date('leave_date').notNull(),
  dayPart: dayPartEnum('day_part').notNull().default('FULL_DAY'),
  dayValue: numeric('day_value', { precision: 3, scale: 1 }).notNull().default('1.0'),
  isWorkingDay: boolean('is_working_day').notNull().default(true),
  isHoliday: boolean('is_holiday').notNull().default(false),
})

export const leaveRequestAttachments = pgTable('leave_request_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leaveRequestRuleChecks = pgTable('leave_request_rule_checks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  requestId: uuid('request_id').notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id').references(() => leavePolicyRules.id, { onDelete: 'set null' }),
  ruleCode: varchar('rule_code', { length: 60 }).notNull(),
  ruleType: ruleTypeEnum('rule_type').notNull(),
  passed: boolean('passed').notNull(),
  violationAction: ruleViolationActionEnum('violation_action'),
  message: text('message'),
  context: jsonb('context').notNull().default({}),
  evaluationPhase: varchar('evaluation_phase', { length: 20 }).notNull().default('SUBMIT'),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
})
