import { describe, it, expect } from 'vitest'
import {
  quotaSufficient,
  maxConcurrentTeamOnLeave,
  noOverlapRequest,
} from '../../server/services/rules/evaluators/resource'
import { createMockRuleContext } from './helpers'

describe('Resource Rule Evaluators', () => {
  describe('QUOTA_SUFFICIENT', () => {
    it('Sisa kuota 5 minta 5 -> lolos', () => {
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-02',
          endDate: '2026-03-06',
          totalDays: 5,
          workingDays: 5,
          attachmentCount: 0,
          days: [],
        },
        quota: {
          balance: 5,
          allocated: 12,
          used: 7,
          reserved: 0,
        },
      })
      const res = quotaSufficient({}, ctx)
      expect(res.passed).toBe(true)
      expect(res.context.balance).toBe(5)
    })

    it('Sisa kuota 5 minta 5.5 -> gagal', () => {
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-02',
          endDate: '2026-03-07',
          totalDays: 5.5,
          workingDays: 5.5,
          attachmentCount: 0,
          days: [],
        },
        quota: {
          balance: 5,
          allocated: 12,
          used: 7,
          reserved: 0,
        },
      })
      const res = quotaSufficient({}, ctx)
      expect(res.passed).toBe(false)
    })

    it('Jenis izin tanpa kuota (quota is null) selalu lolos', () => {
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-2',
          startDate: '2026-03-02',
          endDate: '2026-03-05',
          totalDays: 4,
          workingDays: 4,
          attachmentCount: 0,
          days: [],
        },
        quota: null,
      })
      const res = quotaSufficient({}, ctx)
      expect(res.passed).toBe(true)
    })
  })

  describe('MAX_CONCURRENT_TEAM_ON_LEAVE', () => {
    it('Maksimal 2 orang: baru 1 orang yang izin -> lolos (1 + 1 <= 2)', () => {
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-04',
          endDate: '2026-03-04',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-04', isWorkingDay: true, dayValue: 1 }],
        },
        usage: {
          daysByWeek: {},
          daysByMonth: {},
          daysThisYear: 0,
          requestsThisMonth: 0,
          approvedDates: [],
          hasPreviousRequestEver: false,
          previousRequestNumber: null,
          overlappingRequestNumber: null,
          teamOnLeaveByDate: { '2026-03-04': 1 },
        },
      })
      const res = maxConcurrentTeamOnLeave({ max_people: 2 }, ctx)
      expect(res.passed).toBe(true)
    })

    it('Maksimal 2 orang: sudah ada 2 orang yang izin -> gagal (2 + 1 = 3 > 2)', () => {
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-04',
          endDate: '2026-03-04',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-04', isWorkingDay: true, dayValue: 1 }],
        },
        usage: {
          daysByWeek: {},
          daysByMonth: {},
          daysThisYear: 0,
          requestsThisMonth: 0,
          approvedDates: [],
          hasPreviousRequestEver: false,
          previousRequestNumber: null,
          overlappingRequestNumber: null,
          teamOnLeaveByDate: { '2026-03-04': 2 },
        },
      })
      const res = maxConcurrentTeamOnLeave({ max_people: 2 }, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.violating_dates).toContain('2026-03-04')
    })
  })

  describe('NO_OVERLAP_REQUEST', () => {
    it('Lolos jika tidak ada pengajuan yang bertumpuk', () => {
      const ctx = createMockRuleContext({
        usage: {
          daysByWeek: {},
          daysByMonth: {},
          daysThisYear: 0,
          requestsThisMonth: 0,
          approvedDates: [],
          hasPreviousRequestEver: false,
          previousRequestNumber: null,
          overlappingRequestNumber: null,
          teamOnLeaveByDate: {},
        },
      })
      const res = noOverlapRequest({}, ctx)
      expect(res.passed).toBe(true)
    })

    it('Gagal jika ada pengajuan lain yang bertumpuk', () => {
      const ctx = createMockRuleContext({
        usage: {
          daysByWeek: {},
          daysByMonth: {},
          daysThisYear: 0,
          requestsThisMonth: 0,
          approvedDates: [],
          hasPreviousRequestEver: false,
          previousRequestNumber: null,
          overlappingRequestNumber: 'REQ/2026/007',
          teamOnLeaveByDate: {},
        },
      })
      const res = noOverlapRequest({}, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.conflict_request_number).toBe('REQ/2026/007')
    })
  })
})
