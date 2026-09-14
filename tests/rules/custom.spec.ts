import { describe, it, expect } from 'vitest'
import { customExpression } from '../../server/services/rules/evaluators/custom'
import { createMockRuleContext } from './helpers'

describe('Custom Expression Rule Evaluator', () => {
  it('Mengevaluasi kondisi lte totalDays secara dinamis', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-02',
        endDate: '2026-03-05',
        totalDays: 4,
        workingDays: 4,
        attachmentCount: 0,
        days: [],
      },
    })
    const resPass = customExpression(
      { expression: { field: 'totalDays', op: 'lte', value: 5 } },
      ctx
    )
    expect(resPass.passed).toBe(true)

    const resFail = customExpression(
      { expression: { field: 'totalDays', op: 'lte', value: 3 } },
      ctx
    )
    expect(resFail.passed).toBe(false)
  })

  it('Menangani string JSON expression', () => {
    const ctx = createMockRuleContext({
      employee: {
        id: 'emp-1',
        gender: 'MALE',
        employmentStatus: 'PERMANENT',
        joinDate: '2024-01-01',
        departmentId: 'dept-1',
        employmentMonths: 24,
      },
    })
    const res = customExpression(
      { expression: '{"field":"employmentMonths","op":"gte","value":12}' },
      ctx
    )
    expect(res.passed).toBe(true)
  })

  it('Menolak field yang tidak diizinkan dengan aman (passed = false)', () => {
    const ctx = createMockRuleContext()
    const res = customExpression(
      { expression: { field: 'unauthorizedField', op: 'eq', value: 'secret' } },
      ctx
    )
    expect(res.passed).toBe(false)
  })
})
