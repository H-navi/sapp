import { pgTable, uuid, varchar, text, boolean, timestamp, date, smallint, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { genderEnum, employmentStatusEnum } from './enums'

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => departments.id, { onDelete: 'set null' }),
  headEmployeeId: uuid('head_employee_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  level: smallint('level').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  nip: varchar('nip', { length: 30 }).notNull().unique(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 30 }),
  telegramChatId: varchar('telegram_chat_id', { length: 50 }),
  telegramUsername: varchar('telegram_username', { length: 60 }),
  gender: genderEnum('gender'),
  birthDate: date('birth_date'),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  positionId: uuid('position_id').references(() => positions.id, { onDelete: 'set null' }),
  managerId: uuid('manager_id').references((): AnyPgColumn => employees.id, { onDelete: 'set null' }),
  employmentStatus: employmentStatusEnum('employment_status').notNull().default('PERMANENT'),
  joinDate: date('join_date').notNull(),
  endDate: date('end_date'),
  canSubmitRequest: boolean('can_submit_request').notNull().default(true),
  photoUrl: text('photo_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})
