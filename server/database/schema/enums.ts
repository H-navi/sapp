import { pgEnum } from 'drizzle-orm/pg-core'

export const genderEnum = pgEnum('gender_enum', ['MALE', 'FEMALE'])

export const employmentStatusEnum = pgEnum('employment_status_enum', [
  'PERMANENT',
  'CONTRACT',
  'PROBATION',
  'INTERN',
  'OUTSOURCE',
])

export const leaveUnitEnum = pgEnum('leave_unit_enum', ['DAY', 'HALF_DAY', 'HOUR'])

export const dayPartEnum = pgEnum('day_part_enum', ['FULL_DAY', 'MORNING', 'AFTERNOON'])

export const requestStatusEnum = pgEnum('request_status_enum', [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
])

export const approvalTaskStatusEnum = pgEnum('approval_task_status_enum', [
  'WAITING',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SKIPPED',
  'ESCALATED',
  'EXPIRED',
  'CANCELLED',
])

export const actionSourceEnum = pgEnum('action_source_enum', [
  'USER',
  'SYSTEM_AUTO',
  'SYSTEM_ESCALATION',
  'ADMIN_OVERRIDE',
])

export const approverTypeEnum = pgEnum('approver_type_enum', [
  'DIRECT_MANAGER',
  'POSITION_LEVEL',
  'POSITION',
  'DEPARTMENT_HEAD',
  'SPECIFIC_EMPLOYEE',
  'ROLE',
  'HR_DEPARTMENT',
])

export const approvalModeEnum = pgEnum('approval_mode_enum', ['ANY_ONE', 'ALL', 'QUORUM'])

export const escalationActionEnum = pgEnum('escalation_action_enum', [
  'AUTO_APPROVE',
  'AUTO_REJECT',
  'ESCALATE_NEXT_STEP',
  'ESCALATE_TO_STEP',
  'NOTIFY_ADMIN_ONLY',
  'KEEP_WAITING',
])

export const ruleTypeEnum = pgEnum('rule_type_enum', [
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
])

export const ruleViolationActionEnum = pgEnum('rule_violation_action_enum', [
  'BLOCK_SUBMIT',
  'AUTO_REJECT',
  'REQUIRE_APPROVAL',
  'WARN_ONLY',
])

export const notificationChannelEnum = pgEnum('notification_channel_enum', ['EMAIL', 'TELEGRAM', 'IN_APP'])

export const notificationStatusEnum = pgEnum('notification_status_enum', [
  'QUEUED',
  'SENDING',
  'SENT',
  'FAILED',
  'CANCELLED',
])

export const notificationEventEnum = pgEnum('notification_event_enum', [
  'REQUEST_SUBMITTED',
  'APPROVAL_TASK_ASSIGNED',
  'APPROVAL_REMINDER',
  'APPROVAL_ESCALATED',
  'STEP_APPROVED',
  'STEP_REJECTED',
  'REQUEST_APPROVED',
  'REQUEST_REJECTED',
  'REQUEST_AUTO_APPROVED',
  'REQUEST_AUTO_REJECTED',
  'REQUEST_CANCELLED',
  'REQUEST_EXPIRED',
  'DELEGATION_ASSIGNED',
  'QUOTA_LOW',
])

export const quotaTxnEnum = pgEnum('quota_txn_enum', [
  'ALLOCATION',
  'CARRY_OVER',
  'RESERVATION',
  'RELEASE',
  'USAGE',
  'ADJUSTMENT',
  'EXPIRY',
])

export const auditActorEnum = pgEnum('audit_actor_enum', ['USER', 'SYSTEM', 'ADMIN'])
