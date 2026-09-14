import type { Transaction } from '../../database'

export interface RuleDay {
  date: string
  isWorkingDay: boolean
  dayValue: number
}

export interface RuleContext {
  // pengajuan yang sedang diperiksa
  request: {
    id?: string
    leaveTypeId: string
    startDate: string // 'YYYY-MM-DD'
    endDate: string // 'YYYY-MM-DD'
    totalDays: number
    workingDays: number
    attachmentCount: number
    days: RuleDay[]
  }
  employee: {
    id: string
    name?: string
    gender: 'MALE' | 'FEMALE' | null
    employmentStatus: string
    joinDate: string
    departmentId: string | null
    employmentMonths: number // dihitung di context.ts atau SQL
  }
  leaveType: {
    code: string
    name: string
    countsWorkingDaysOnly: boolean
  }
  // data agregat yang sudah diambil sekali
  usage: {
    daysByWeek: Record<string, number> // kunci: 'YYYY-Www' (ISO week)
    daysByMonth: Record<string, number> // kunci: 'YYYY-MM'
    daysThisYear: number
    requestsThisMonth: number
    approvedDates: string[] // tanggal izin jenis sama yang sudah disetujui/berjalan
    hasPreviousRequestEver: boolean
    previousRequestNumber: string | null
    overlappingRequestNumber: string | null
    teamOnLeaveByDate: Record<string, number>
  }
  quota: { balance: number; allocated: number; used: number; reserved: number } | null
  today: string // 'YYYY-MM-DD' zona Asia/Jakarta
  holidays?: string[] // daftar tanggal libur untuk evaluasi murni
}

export interface RuleOutcome {
  passed: boolean
  /** nilai untuk mengisi placeholder message_template, sekaligus disimpan sebagai audit */
  context: Record<string, unknown>
}

export type RuleEvaluator = (params: Record<string, any>, ctx: RuleContext) => RuleOutcome

export interface EvaluateInput {
  tx: Transaction
  employeeId: string
  leaveTypeId: string
  policyId?: string | null
  startDate: string
  endDate: string
  totalDays: number
  workingDays: number
  attachmentCount: number
  phase: 'SUBMIT' | 'AUTO_DECISION' | 'MANUAL_REVIEW'
  excludeRequestId?: string
}

export interface RuleDetail {
  ruleId: string
  ruleCode: string
  ruleType: string
  passed: boolean
  violationAction: string | null
  message: string
  context: Record<string, unknown>
}

export interface RuleCheckResult {
  passed: boolean
  blockingMessages: string[] // violation_action = BLOCK_SUBMIT
  autoRejectMessages: string[] // violation_action = AUTO_REJECT
  requiresManualApproval: boolean // ada rule REQUIRE_APPROVAL yang gagal
  warnings: string[] // violation_action = WARN_ONLY
  details: RuleDetail[]
}
