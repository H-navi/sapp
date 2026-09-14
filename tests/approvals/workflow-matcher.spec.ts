import { describe, it, expect } from 'vitest'
import { createMockRequestContext } from './helpers'

describe('Approval Workflow Matching Logic', () => {
  interface MockWorkflowRule {
    code: string
    leaveTypeId: string | null
    departmentId: string | null
    minDays: number | null
    maxDays: number | null
    priority: number
    isActive?: boolean
    effectiveTo?: string | null
  }

  const seededWorkflows: MockWorkflowRule[] = [
    { code: 'WF_DEFAULT', leaveTypeId: null, departmentId: null, minDays: null, maxDays: null, priority: 100 },
    { code: 'WF_WFA', leaveTypeId: 'lt-wfa', departmentId: null, minDays: null, maxDays: null, priority: 10 },
    { code: 'WF_SAKIT', leaveTypeId: 'lt-sakit', departmentId: null, minDays: null, maxDays: null, priority: 20 },
    { code: 'WF_CUTI_PENDEK', leaveTypeId: 'lt-cuti', departmentId: null, minDays: 0.5, maxDays: 5, priority: 20 },
    { code: 'WF_CUTI_PANJANG', leaveTypeId: 'lt-cuti', departmentId: null, minDays: 5.5, maxDays: null, priority: 10 },
  ]

  function matchMockWorkflow(
    rules: MockWorkflowRule[],
    request: ReturnType<typeof createMockRequestContext>,
    currentDate = '2026-09-15'
  ) {
    const matched = rules
      .filter((w) => {
        if (w.isActive === false) return false
        if (w.effectiveTo && w.effectiveTo < currentDate) return false
        if (w.leaveTypeId != null && w.leaveTypeId !== request.leaveTypeId) return false
        if (w.departmentId != null && w.departmentId !== request.employee.departmentId) return false
        if (w.minDays != null && request.totalDays < w.minDays) return false
        if (w.maxDays != null && request.totalDays > w.maxDays) return false
        return true
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        const aSpec = (a.leaveTypeId ? 1 : 0) + (a.departmentId ? 1 : 0)
        const bSpec = (b.leaveTypeId ? 1 : 0) + (b.departmentId ? 1 : 0)
        return bSpec - aSpec
      })

    if (matched.length === 0) {
      throw new Error('APPROVAL_NO_WORKFLOW: Alur persetujuan untuk jenis izin ini belum dikonfigurasi.')
    }
    return matched[0]
  }

  it('WFA mencocokkan WF_WFA (prioritas 10) mendahului WF_DEFAULT', () => {
    const req = createMockRequestContext({ leaveTypeId: 'lt-wfa', totalDays: 1 })
    const wf = matchMockWorkflow(seededWorkflows, req)
    expect(wf.code).toBe('WF_WFA')
  })

  it('Cuti Tahunan tepat 5 hari mencocokkan WF_CUTI_PENDEK (uji batas)', () => {
    const req5 = createMockRequestContext({ leaveTypeId: 'lt-cuti', totalDays: 5 })
    const wf5 = matchMockWorkflow(seededWorkflows, req5)
    expect(wf5.code).toBe('WF_CUTI_PENDEK')
  })

  it('Cuti Tahunan 5.5 hari mencocokkan WF_CUTI_PANJANG (uji batas)', () => {
    const req55 = createMockRequestContext({ leaveTypeId: 'lt-cuti', totalDays: 5.5 })
    const wf55 = matchMockWorkflow(seededWorkflows, req55)
    expect(wf55.code).toBe('WF_CUTI_PANJANG')
  })

  it('Alur spesifik jenis izin mengalahkan WF_DEFAULT meski priority sama', () => {
    const rulesWithSamePriority: MockWorkflowRule[] = [
      { code: 'WF_DEFAULT', leaveTypeId: null, departmentId: null, minDays: null, maxDays: null, priority: 50 },
      { code: 'WF_SPESIFIK', leaveTypeId: 'lt-khusus', departmentId: null, minDays: null, maxDays: null, priority: 50 },
    ]
    const req = createMockRequestContext({ leaveTypeId: 'lt-khusus', totalDays: 2 })
    const wf = matchMockWorkflow(rulesWithSamePriority, req)
    expect(wf.code).toBe('WF_SPESIFIK')
  })

  it('Alur kedaluwarsa (effective_to kemarin) tidak terpilih', () => {
    const rulesWithExpired: MockWorkflowRule[] = [
      {
        code: 'WF_EXPIRED',
        leaveTypeId: 'lt-promo',
        departmentId: null,
        minDays: null,
        maxDays: null,
        priority: 5,
        effectiveTo: '2026-09-14', // kemarin
      },
      {
        code: 'WF_DEFAULT',
        leaveTypeId: null,
        departmentId: null,
        minDays: null,
        maxDays: null,
        priority: 100,
        effectiveTo: null,
      },
    ]
    const req = createMockRequestContext({ leaveTypeId: 'lt-promo', totalDays: 1 })
    const wf = matchMockWorkflow(rulesWithExpired, req, '2026-09-15')
    expect(wf.code).toBe('WF_DEFAULT')
  })

  it('Jenis izin tanpa aturan spesifik jatuh ke WF_DEFAULT', () => {
    const req = createMockRequestContext({ leaveTypeId: 'lt-lainnya', totalDays: 2 })
    const wf = matchMockWorkflow(seededWorkflows, req)
    expect(wf.code).toBe('WF_DEFAULT')
  })

  it('Melempar error APPROVAL_NO_WORKFLOW bila tidak ada alur yang cocok sama sekali', () => {
    const req = createMockRequestContext({ leaveTypeId: 'lt-khusus', totalDays: 2 })
    expect(() => matchMockWorkflow([], req)).toThrow('APPROVAL_NO_WORKFLOW')
  })
})

