import { pgTable, uuid, varchar, text, boolean, timestamp, smallint, numeric } from 'drizzle-orm/pg-core'
import { leaveUnitEnum, genderEnum, employmentStatusEnum } from './enums'
import { employees, departments, positions } from './org'
import { users } from './auth'

export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  unit: leaveUnitEnum('unit').notNull().default('DAY'),
  deductsQuota: boolean('deducts_quota').notNull().default(false),
  defaultAnnualQuota: numeric('default_annual_quota', { precision: 5, scale: 1 }),
  requiresAttachment: boolean('requires_attachment').notNull().default(false),
  genderRestriction: genderEnum('gender_restriction'),
  allowHalfDay: boolean('allow_half_day').notNull().default(false),
  allowBackdate: boolean('allow_backdate').notNull().default(false),
  maxBackdateDays: smallint('max_backdate_days').notNull().default(0),
  countsWorkingDaysOnly: boolean('counts_working_days_only').notNull().default(true),
  color: varchar('color', { length: 9 }).notNull().default('#64748B'),
  icon: varchar('icon', { length: 40 }),
  sortOrder: smallint('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leaveTypeEligibilities = pgTable('leave_type_eligibilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => leaveTypes.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }),
  positionId: uuid('position_id').references(() => positions.id, { onDelete: 'cascade' }),
  employmentStatus: employmentStatusEnum('employment_status'),
  isAllowed: boolean('is_allowed').notNull().default(true),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
