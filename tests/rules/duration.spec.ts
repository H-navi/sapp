import { describe, it, expect } from 'vitest'
import {
  maxDaysPerRequest,
  minDaysPerRequest,
  maxDaysPerPeriod,
  maxRequestsPerPeriod,
  maxPerYear,
} from '../../server/services/rules/evaluators/duration'
import { createMockRuleContext } from './helpers'

describe('Duration Rule Evaluators', () => {
  it('MAX_DAYS_PER_REQUEST: lolos jika di bawah atau sama dengan batas', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-02',
        endDate: '2026-03-04',
        totalDays: 3,
        workingDays: 3,
        attachmentCount: 0,
        days: [],
      },
    })
    const res = maxDaysPerRequest({ max_days: 5 }, ctx)
    expect(res.passed).toBe(true)
    expect(res.context.requested_days).toBe(3)
  })

  it('MAX_DAYS_PER_REQUEST: gagal jika melebihi batas', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-02',
        endDate: '2026-03-09',
        totalDays: 6,
        workingDays: 6,
        attachmentCount: 0,
        days: [],
      },
    })
    const res = maxDaysPerRequest({ max_days: 5 }, ctx)
    expect(res.passed).toBe(false)
    expect(res.context.max_days).toBe(5)
  })

  it('MIN_DAYS_PER_REQUEST: lolos jika memenuhi minimal hari', () => {
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
    const res = minDaysPerRequest({ min_days: 2 }, ctx)
    expect(res.passed).toBe(true)
  })

  it('MIN_DAYS_PER_REQUEST: gagal jika kurang dari batas minimal', () => {
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
    const res = minDaysPerRequest({ min_days: 2 }, ctx)
    expect(res.passed).toBe(false)
  })

  it('MAX_DAYS_PER_PERIOD: 0 terpakai + 2 hari requested -> lolos', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-03',
        endDate: '2026-03-05',
        totalDays: 2,
        workingDays: 2,
        attachmentCount: 0,
        days: [
          { date: '2026-03-03', isWorkingDay: true, dayValue: 1 },
          { date: '2026-03-05', isWorkingDay: true, dayValue: 1 },
        ],
      },
      usage: {
        daysByWeek: { '2026-W10': 0 },
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
    const res = maxDaysPerPeriod({ max_days: 2, period: 'WEEK' }, ctx)
    expect(res.passed).toBe(true)
  })

  it('MAX_DAYS_PER_PERIOD: 1 terpakai + 2 hari requested -> gagal jika batas 2 hari/minggu', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-03',
        endDate: '2026-03-05',
        totalDays: 2,
        workingDays: 2,
        attachmentCount: 0,
        days: [
          { date: '2026-03-03', isWorkingDay: true, dayValue: 1 },
          { date: '2026-03-05', isWorkingDay: true, dayValue: 1 },
        ],
      },
      usage: {
        daysByWeek: { '2026-W10': 1 },
        daysByMonth: {},
        daysThisYear: 1,
        requestsThisMonth: 1,
        approvedDates: [],
        hasPreviousRequestEver: false,
        previousRequestNumber: null,
        overlappingRequestNumber: null,
        teamOnLeaveByDate: {},
      },
    })
    const res = maxDaysPerPeriod({ max_days: 2, period: 'WEEK' }, ctx)
    expect(res.passed).toBe(false)
    expect(res.context.current_days).toBe(1)
  })

  it('MAX_DAYS_PER_PERIOD: melintasi dua minggu berbeda (1 hari per minggu) dengan batas 1 hari -> lolos', () => {
    // 2026-03-06 adalah Jumat (W10), 2026-03-09 adalah Senin (W11)
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-06',
        endDate: '2026-03-09',
        totalDays: 2,
        workingDays: 2,
        attachmentCount: 0,
        days: [
          { date: '2026-03-06', isWorkingDay: true, dayValue: 1 },
          { date: '2026-03-09', isWorkingDay: true, dayValue: 1 },
        ],
      },
      usage: {
        daysByWeek: { '2026-W10': 0, '2026-W11': 0 },
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
    const res = maxDaysPerPeriod({ max_days: 1, period: 'WEEK' }, ctx)
    expect(res.passed).toBe(true)
  })

  it('MAX_REQUESTS_PER_PERIOD: batas jumlah pengajuan dalam 1 periode', () => {
    const ctx = createMockRuleContext({
      usage: {
        daysByWeek: {},
        daysByMonth: {},
        daysThisYear: 0,
        requestsThisMonth: 2,
        approvedDates: [],
        hasPreviousRequestEver: false,
        previousRequestNumber: null,
        overlappingRequestNumber: null,
        teamOnLeaveByDate: {},
      },
    })
    // 2 + 1 = 3 > 2 -> gagal
    const resFail = maxRequestsPerPeriod({ max_requests: 2, period: 'MONTH' }, ctx)
    expect(resFail.passed).toBe(false)
    expect(resFail.context.current_count).toBe(2)

    // Jika batas 3 -> lolos (2 + 1 <= 3)
    const resPass = maxRequestsPerPeriod({ max_requests: 3, period: 'MONTH' }, ctx)
    expect(resPass.passed).toBe(true)
  })

  it('MAX_PER_YEAR: batas akumulasi hari per tahun', () => {
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
      usage: {
        daysByWeek: {},
        daysByMonth: {},
        daysThisYear: 12,
        requestsThisMonth: 1,
        approvedDates: [],
        hasPreviousRequestEver: false,
        previousRequestNumber: null,
        overlappingRequestNumber: null,
        teamOnLeaveByDate: {},
      },
    })
    // 12 + 2 = 14 <= 14 -> lolos
    const passRes = maxPerYear({ max_days: 14 }, ctx)
    expect(passRes.passed).toBe(true)

    // Jika batas 13 -> 12 + 2 = 14 > 13 -> gagal
    const failRes = maxPerYear({ max_days: 13 }, ctx)
    expect(failRes.passed).toBe(false)
  })

  it('MAX_DAYS_PER_PERIOD: tepat di batas (2 dari 2) -> lolos; 2.5 -> gagal', () => {
    const ctxExact = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-03',
        endDate: '2026-03-04',
        totalDays: 2,
        workingDays: 2,
        attachmentCount: 0,
        days: [
          { date: '2026-03-03', isWorkingDay: true, dayValue: 1 },
          { date: '2026-03-04', isWorkingDay: true, dayValue: 1 },
        ],
      },
      usage: {
        daysByWeek: { '2026-W10': 0 },
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
    // 2 dari 2 -> lolos
    const resExact = maxDaysPerPeriod({ max_days: 2, period: 'WEEK' }, ctxExact)
    expect(resExact.passed).toBe(true)

    // 2.5 hari -> gagal
    const ctxOver = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-03',
        endDate: '2026-03-05',
        totalDays: 2.5,
        workingDays: 2.5,
        attachmentCount: 0,
        days: [
          { date: '2026-03-03', isWorkingDay: true, dayValue: 1 },
          { date: '2026-03-04', isWorkingDay: true, dayValue: 1 },
          { date: '2026-03-05', isWorkingDay: true, dayValue: 0.5 },
        ],
      },
      usage: {
        daysByWeek: { '2026-W10': 0 },
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
    const resOver = maxDaysPerPeriod({ max_days: 2, period: 'WEEK' }, ctxOver)
    expect(resOver.passed).toBe(false)
  })

  it('Pengajuan setengah hari dihitung 0.5, bukan 1', () => {
    const ctxHalf = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-03',
        endDate: '2026-03-03',
        totalDays: 0.5,
        workingDays: 0.5,
        attachmentCount: 0,
        days: [
          { date: '2026-03-03', isWorkingDay: true, dayValue: 0.5 },
        ],
      },
      usage: {
        daysByWeek: { '2026-W10': 1 },
        daysByMonth: {},
        daysThisYear: 1,
        requestsThisMonth: 1,
        approvedDates: [],
        hasPreviousRequestEver: false,
        previousRequestNumber: null,
        overlappingRequestNumber: null,
        teamOnLeaveByDate: {},
      },
    })
    // 1 terpakai + 0.5 = 1.5 <= 1.5 -> lolos jika batas 1.5
    const resPass = maxDaysPerPeriod({ max_days: 1.5, period: 'WEEK' }, ctxHalf)
    expect(resPass.passed).toBe(true)

    // Jika batas 1.2 -> 1.5 > 1.2 -> gagal
    const resFail = maxDaysPerPeriod({ max_days: 1.2, period: 'WEEK' }, ctxHalf)
    expect(resFail.passed).toBe(false)
  })

  it('Aturan dengan params kosong atau salah bentuk tidak melempar uncaught error', () => {
    const ctx = createMockRuleContext({
      request: {
        leaveTypeId: 'lt-1',
        startDate: '2026-03-03',
        endDate: '2026-03-03',
        totalDays: 1,
        workingDays: 1,
        attachmentCount: 0,
        days: [{ date: '2026-03-03', isWorkingDay: true, dayValue: 1 }],
      },
    })

    // Params kosong {}
    expect(() => maxDaysPerRequest({}, ctx)).not.toThrow()
    expect(() => minDaysPerRequest({}, ctx)).not.toThrow()
    expect(() => maxDaysPerPeriod({}, ctx)).not.toThrow()

    // Params salah bentuk / tipe aneh
    expect(() => maxDaysPerRequest({ max_days: 'invalid' as any }, ctx)).not.toThrow()
    expect(() => maxDaysPerPeriod({ max_days: null as any, period: undefined }, ctx)).not.toThrow()
  })
})

