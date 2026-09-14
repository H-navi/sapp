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

export const ruleCreateSchema = z.object({
  ruleCode: z.string().trim().min(2).max(60),
  ruleType: z.enum([
    'MAX_DAYS_PER_REQUEST',
    'MIN_DAYS_PER_REQUEST',
    'MAX_DAYS_PER_PERIOD',
    'MAX_REQUESTS_PER_PERIOD',
    'NO_CONSECUTIVE_DAYS',
    'ALLOWED_WEEKDAYS',
    'MIN_NOTICE_DAYS',
    'MAX_BACKDATE_DAYS',
    'QUOTA_SUFFICIENT',
    'ATTACHMENT_REQUIRED',
    'ATTACHMENT_REQUIRED_IF_DAYS_GTE',
    'GENDER_RESTRICTION',
    'MIN_EMPLOYMENT_MONTHS',
    'EMPLOYMENT_STATUS_ALLOWED',
    'ONCE_PER_EMPLOYMENT',
    'MAX_PER_YEAR',
    'NO_OVERLAP_REQUEST',
    'BLACKOUT_PERIOD',
    'MAX_CONCURRENT_TEAM_ON_LEAVE',
    'CUSTOM_EXPRESSION',
  ]),
  params: z.record(z.any()).default({}),
  violationAction: z.enum(['BLOCK_SUBMIT', 'AUTO_REJECT', 'REQUIRE_APPROVAL', 'WARN_ONLY']).default('BLOCK_SUBMIT'),
  messageTemplate: z.string().trim().min(5),
  evaluationOrder: z.coerce.number().int().min(1).max(999).default(100),
  isActive: z.boolean().default(true),
})

export const ruleUpdateSchema = z.object({
  ruleCode: z.string().trim().min(2).max(60).optional(),
  params: z.record(z.any()).optional(),
  violationAction: z.enum(['BLOCK_SUBMIT', 'AUTO_REJECT', 'REQUIRE_APPROVAL', 'WARN_ONLY']).optional(),
  messageTemplate: z.string().trim().min(5).optional(),
  evaluationOrder: z.coerce.number().int().min(1).max(999).optional(),
  isActive: z.boolean().optional(),
})

export const policyNewVersionSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD wajib valid'),
  overallDeadlineHours: z.coerce.number().positive().optional(),
  deadlineUsesWorkingHours: z.boolean().optional(),
  onDeadlineAction: z
    .enum(['AUTO_APPROVE', 'AUTO_REJECT', 'ESCALATE_NEXT_STEP', 'ESCALATE_TO_STEP', 'NOTIFY_ADMIN_ONLY', 'KEEP_WAITING'])
    .optional(),
  autoDecisionRequiresRulePass: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

export const policyTestDryRunSchema = z.object({
  employeeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDayPart: z.enum(['FULL_DAY', 'MORNING', 'AFTERNOON']).default('FULL_DAY'),
  endDayPart: z.enum(['FULL_DAY', 'MORNING', 'AFTERNOON']).default('FULL_DAY'),
  attachmentCount: z.coerce.number().int().min(0).default(0),
})

export const workflowInputSchema = z.object({
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(150),
  description: z.string().optional().nullable(),
  leaveTypeId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  positionLevelMin: z.coerce.number().int().min(1).max(10).optional().nullable(),
  positionLevelMax: z.coerce.number().int().min(1).max(10).optional().nullable(),
  employmentStatus: z.enum(['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'OUTSOURCE']).optional().nullable(),
  minDays: z.coerce.number().min(0.5).max(365).optional().nullable(),
  maxDays: z.coerce.number().min(0.5).max(365).optional().nullable(),
  priority: z.coerce.number().int().min(1).max(999).default(100),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().substring(0, 10)),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const baseWorkflowStepSchema = z.object({
  stepOrder: z.coerce.number().int().min(1),
  name: z.string().trim().min(2).max(100),
  approverType: z.enum([
    'DIRECT_MANAGER',
    'POSITION_LEVEL',
    'POSITION',
    'DEPARTMENT_HEAD',
    'SPECIFIC_EMPLOYEE',
    'ROLE',
    'HR_DEPARTMENT',
  ]),
  approverPositionId: z.string().uuid().optional().nullable(),
  approverPositionLevel: z.coerce.number().int().min(1).max(10).optional().nullable(),
  approverEmployeeId: z.string().uuid().optional().nullable(),
  approverRoleId: z.string().uuid().optional().nullable(),
  approvalMode: z.enum(['ANY_ONE', 'ALL', 'QUORUM']).default('ANY_ONE'),
  quorumCount: z.coerce.number().int().min(1).optional().nullable(),
  isOptional: z.boolean().default(false),
  skipIfRequester: z.boolean().default(true),
  skipIfAlreadyApproved: z.boolean().default(true),
  conditionMinDays: z.coerce.number().min(0.5).optional().nullable(),
  slaHours: z.coerce.number().min(0.5).default(8.0),
  slaUsesWorkingHours: z.boolean().default(true),
  reminderEnabled: z.boolean().default(true),
  reminderIntervalMinutes: z.coerce.number().int().min(5).default(120),
  reminderMaxCount: z.coerce.number().int().min(1).max(20).default(5),
  escalationAction: z
    .enum(['AUTO_APPROVE', 'AUTO_REJECT', 'ESCALATE_NEXT_STEP', 'ESCALATE_TO_STEP', 'NOTIFY_ADMIN_ONLY', 'KEEP_WAITING'])
    .default('AUTO_APPROVE'),
  escalateToStepOrder: z.coerce.number().int().min(1).optional().nullable(),
  escalationNotifyAdmin: z.boolean().default(true),
  allowDelegation: z.boolean().default(true),
})

export const workflowStepPatchSchema = baseWorkflowStepSchema.partial()

export const workflowStepInputSchema = baseWorkflowStepSchema.refine(
  (data) => {
    if (data.approvalMode === 'QUORUM' && (!data.quorumCount || data.quorumCount < 1)) {
      return false
    }
    return true
  },
  {
    message: 'Mode QUORUM mewajibkan jumlah quorum minimal 1.',
    path: ['quorumCount'],
  }
)

export const workflowStepReorderSchema = z.object({
  stepIds: z.array(z.string().uuid()),
})

export const workflowPreviewSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  totalDays: z.coerce.number().positive(),
})
