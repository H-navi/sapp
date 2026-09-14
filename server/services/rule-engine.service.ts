import type { Transaction } from '../database'

export interface RuleCheckResult {
  passed: boolean
  blockingMessages: string[]       // violation_action = BLOCK_SUBMIT
  autoRejectMessages: string[]     // violation_action = AUTO_REJECT
  requiresManualApproval: boolean  // ada rule REQUIRE_APPROVAL yang gagal
  warnings: string[]
  details: Array<{
    ruleId: string
    ruleCode: string
    ruleType: string
    passed: boolean
    violationAction: string | null
    message: string
    context: Record<string, unknown>
  }>
}

export async function evaluateRules(_input: {
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
}): Promise<RuleCheckResult> {
  // STUB langkah 07: sementara kembalikan lolos semua
  return {
    passed: true,
    blockingMessages: [],
    autoRejectMessages: [],
    requiresManualApproval: false,
    warnings: [],
    details: [],
  }
}
