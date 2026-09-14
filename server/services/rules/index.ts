import { sql } from 'drizzle-orm'
import type { EvaluateInput, RuleCheckResult, RuleDetail, RuleOutcome } from './types'
import { buildRuleContext } from './context'
import { ruleRegistry } from './registry'
import { renderMessage, baseVars } from './message'

export * from './types'
export * from './registry'
export * from './context'
export * from './message'

interface LoadedRule {
  id: string
  ruleCode: string
  ruleType: string
  params: Record<string, any>
  violationAction: string
  messageTemplate: string
  evaluationOrder: number
}

/**
 * Muat aturan aktif berdasarkan policyId atau leaveTypeId.
 */
export async function loadActiveRules(
  tx: any,
  policyId?: string | null,
  leaveTypeId?: string
): Promise<LoadedRule[]> {
  let targetPolicyId = policyId

  // Jika policyId tidak diberikan, cari kebijakan aktif untuk jenis cuti tersebut
  if (!targetPolicyId && leaveTypeId) {
    const polRows = (await tx.execute(sql`
      SELECT id
      FROM leave_policies
      WHERE leave_type_id = ${leaveTypeId}::uuid
        AND is_active = true
        AND effective_from <= CURRENT_DATE
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      ORDER BY version DESC
      LIMIT 1
    `)) as any[]

    if (polRows.length > 0) {
      targetPolicyId = polRows[0].id
    }
  }

  if (!targetPolicyId) {
    return []
  }

  const rows = (await tx.execute(sql`
    SELECT id,
           rule_code,
           rule_type,
           params,
           violation_action,
           message_template,
           evaluation_order
    FROM leave_policy_rules
    WHERE policy_id = ${targetPolicyId}::uuid
      AND is_active = true
    ORDER BY evaluation_order ASC, id ASC
  `)) as any[]

  return rows.map((r) => ({
    id: r.id,
    ruleCode: r.rule_code,
    ruleType: r.rule_type,
    params: (typeof r.params === 'object' && r.params !== null ? r.params : {}) as Record<string, any>,
    violationAction: r.violation_action,
    messageTemplate: r.message_template,
    evaluationOrder: Number(r.evaluation_order ?? 100),
  }))
}

/**
 * Orkestrasi evaluasi seluruh aturan kebijakan yang aktif.
 */
export async function evaluateRules(input: EvaluateInput): Promise<RuleCheckResult> {
  const ctx = await buildRuleContext(input)
  const rules = await loadActiveRules(input.tx, input.policyId, input.leaveTypeId)

  const details: RuleDetail[] = []

  for (const rule of rules) {
    const evaluator = ruleRegistry[rule.ruleType]
    if (!evaluator) {
      console.warn(`[rule-engine] Evaluator belum terdaftar: ${rule.ruleType}`)
      // Kebijakan "gagal aman": rule tanpa evaluator dianggap tidak lolos
      details.push({
        ruleId: rule.id,
        ruleCode: rule.ruleCode,
        ruleType: rule.ruleType,
        passed: false,
        violationAction: rule.violationAction,
        message: `Evaluator untuk aturan '${rule.ruleType}' belum tersedia di sistem.`,
        context: { error: 'Evaluator missing' },
      })
      continue
    }

    let outcome: RuleOutcome
    try {
      outcome = evaluator(rule.params, ctx)
    } catch (err: any) {
      // Kebijakan "gagal aman": jika terjadi error eksekusi, tandai TIDAK LOLOS
      console.error(`[rule-engine] Error pada evaluator ${rule.ruleType} (${rule.ruleCode}):`, err)
      outcome = {
        passed: false,
        context: { error: String(err?.message ?? err) },
      }
    }

    const passed = Boolean(outcome.passed)
    const violationAction = passed ? null : rule.violationAction
    const message = passed
      ? ''
      : renderMessage(rule.messageTemplate, {
          ...outcome.context,
          ...baseVars(ctx),
        })

    details.push({
      ruleId: rule.id,
      ruleCode: rule.ruleCode,
      ruleType: rule.ruleType,
      passed,
      violationAction,
      message,
      context: outcome.context,
    })
  }

  const gagal = details.filter((d) => !d.passed)

  return {
    passed: gagal.length === 0,
    blockingMessages: gagal.filter((d) => d.violationAction === 'BLOCK_SUBMIT').map((d) => d.message),
    autoRejectMessages: gagal.filter((d) => d.violationAction === 'AUTO_REJECT').map((d) => d.message),
    requiresManualApproval: gagal.some((d) => d.violationAction === 'REQUIRE_APPROVAL'),
    warnings: gagal.filter((d) => d.violationAction === 'WARN_ONLY').map((d) => d.message),
    details,
  }
}
