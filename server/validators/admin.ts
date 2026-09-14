import { z } from 'zod'

export const departmentInputSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(150),
  parentId: z.string().uuid().optional().nullable(),
  headEmployeeId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const positionInputSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(150),
  level: z.coerce.number().int().min(1).max(10),
  isActive: z.boolean().default(true),
})

export const leaveTypePatchSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().optional().nullable(),
  defaultAnnualQuota: z.coerce.number().min(0).max(365).optional().nullable(),
  requiresAttachment: z.boolean().optional(),
  allowHalfDay: z.boolean().optional(),
  allowBackdate: z.boolean().optional(),
  maxBackdateDays: z.coerce.number().int().min(0).max(365).optional(),
  countsWorkingDaysOnly: z.boolean().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const eligibilityRuleSchema = z.object({
  id: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
  employmentStatus: z.enum(['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'OUTSOURCE']).optional().nullable(),
  isAllowed: z.boolean(),
  note: z.string().optional().nullable(),
})

export const eligibilityListSchema = z.object({
  rules: z.array(eligibilityRuleSchema),
})

export const holidayInputSchema = z.object({
  holidayDate: z.string().min(10).max(10),
  name: z.string().trim().min(2).max(150),
  type: z.enum(['NATIONAL', 'JOINT_LEAVE', 'COMPANY']).default('NATIONAL'),
  deductsQuota: z.boolean().default(false),
})

export const workingHourInputSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  isWorkingDay: z.boolean(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  breakStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional().nullable(),
  breakEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional().nullable(),
})

export const systemSettingInputSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
})
