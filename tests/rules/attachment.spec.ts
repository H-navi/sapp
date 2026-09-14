import { describe, it, expect } from 'vitest'
import {
  attachmentRequired,
  attachmentRequiredIfDaysGte,
} from '../../server/services/rules/evaluators/attachment'
import { createMockRuleContext } from './helpers'

describe('Attachment Rule Evaluators', () => {
  it('ATTACHMENT_REQUIRED: berkas 0 -> gagal', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-02',
        endDate: '2026-03-02',
        totalDays: 1,
        workingDays: 1,
        attachmentCount: 0,
        days: [],
      },
    })
    const res = attachmentRequired({ min_files: 1 }, ctx)
    expect(res.passed).toBe(false)
  })

  it('ATTACHMENT_REQUIRED: berkas >= 1 -> lolos', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-02',
        endDate: '2026-03-02',
        totalDays: 1,
        workingDays: 1,
        attachmentCount: 1,
        days: [],
      },
    })
    const res = attachmentRequired({ min_files: 1 }, ctx)
    expect(res.passed).toBe(true)
  })

  it('ATTACHMENT_REQUIRED_IF_DAYS_GTE: di bawah batas hari (1 hari < 2 hari) tidak butuh lampiran -> lolos', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-02',
        endDate: '2026-03-02',
        totalDays: 1,
        workingDays: 1,
        attachmentCount: 0,
        days: [],
      },
    })
    const res = attachmentRequiredIfDaysGte({ days: 2, min_files: 1 }, ctx)
    expect(res.passed).toBe(true)
  })

  it('ATTACHMENT_REQUIRED_IF_DAYS_GTE: sama atau lebih dari batas (2 hari >= 2 hari) tanpa lampiran -> gagal', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-02',
        endDate: '2026-03-03',
        totalDays: 2,
        workingDays: 2,
        attachmentCount: 0,
        days: [],
      },
    })
    const res = attachmentRequiredIfDaysGte({ days: 2, min_files: 1 }, ctx)
    expect(res.passed).toBe(false)
  })

  it('ATTACHMENT_REQUIRED_IF_DAYS_GTE: 2 hari >= 2 hari dengan lampiran -> lolos', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-02',
        endDate: '2026-03-03',
        totalDays: 2,
        workingDays: 2,
        attachmentCount: 1,
        days: [],
      },
    })
    const res = attachmentRequiredIfDaysGte({ days: 2, min_files: 1 }, ctx)
    expect(res.passed).toBe(true)
  })
})
