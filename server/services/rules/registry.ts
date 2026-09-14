import type { RuleEvaluator } from './types'
import {
  maxDaysPerRequest,
  minDaysPerRequest,
  maxDaysPerPeriod,
  maxRequestsPerPeriod,
  maxPerYear,
} from './evaluators/duration'
import {
  noConsecutiveDays,
  allowedWeekdays,
  blackoutPeriod,
  minNoticeDays,
  maxBackdateDays,
} from './evaluators/schedule'
import {
  genderRestriction,
  minEmploymentMonths,
  employmentStatusAllowed,
  oncePerEmployment,
} from './evaluators/eligibility'
import {
  quotaSufficient,
  maxConcurrentTeamOnLeave,
  noOverlapRequest,
} from './evaluators/resource'
import {
  attachmentRequired,
  attachmentRequiredIfDaysGte,
} from './evaluators/attachment'
import { customExpression } from './evaluators/custom'
import { ruleTypeEnum } from '../../database/schema/enums'

export const ruleRegistry: Record<string, RuleEvaluator> = {
  MAX_DAYS_PER_REQUEST: maxDaysPerRequest,
  MIN_DAYS_PER_REQUEST: minDaysPerRequest,
  MAX_DAYS_PER_PERIOD: maxDaysPerPeriod,
  MAX_REQUESTS_PER_PERIOD: maxRequestsPerPeriod,
  MAX_PER_YEAR: maxPerYear,

  NO_CONSECUTIVE_DAYS: noConsecutiveDays,
  ALLOWED_WEEKDAYS: allowedWeekdays,
  BLACKOUT_PERIOD: blackoutPeriod,
  MIN_NOTICE_DAYS: minNoticeDays,
  MAX_BACKDATE_DAYS: maxBackdateDays,

  GENDER_RESTRICTION: genderRestriction,
  MIN_EMPLOYMENT_MONTHS: minEmploymentMonths,
  EMPLOYMENT_STATUS_ALLOWED: employmentStatusAllowed,
  ONCE_PER_EMPLOYMENT: oncePerEmployment,

  QUOTA_SUFFICIENT: quotaSufficient,
  MAX_CONCURRENT_TEAM_ON_LEAVE: maxConcurrentTeamOnLeave,
  NO_OVERLAP_REQUEST: noOverlapRequest,

  ATTACHMENT_REQUIRED: attachmentRequired,
  ATTACHMENT_REQUIRED_IF_DAYS_GTE: attachmentRequiredIfDaysGte,

  CUSTOM_EXPRESSION: customExpression,
}

// Pemeriksaan saat inisialisasi: pastikan semua tipe di enum terdaftar
export function verifyRuleRegistry() {
  const missing: string[] = []
  for (const type of ruleTypeEnum.enumValues) {
    if (!ruleRegistry[type]) {
      missing.push(type)
    }
  }
  if (missing.length > 0) {
    console.warn(`[rule-engine] PERINGATAN: Rule type belum memiliki evaluator: ${missing.join(', ')}`)
  }
  return missing
}

// Jalankan verifikasi
verifyRuleRegistry()
