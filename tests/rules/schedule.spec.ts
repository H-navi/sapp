import { describe, it, expect } from 'vitest'
import {
  noConsecutiveDays,
  allowedWeekdays,
  blackoutPeriod,
  minNoticeDays,
  maxBackdateDays,
} from '../../server/services/rules/evaluators/schedule'
import { createMockRuleContext } from './helpers'

describe('Schedule Rule Evaluators', () => {
  describe('NO_CONSECUTIVE_DAYS', () => {
    it('Selasa + Rabu gagal (jarak 0 hari kerja)', () => {
      // 2026-03-03 (Selasa), 2026-03-04 (Rabu)
      const ctx = createMockRuleContext({
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
      })
      const res = noConsecutiveDays({ min_gap_working_days: 1 }, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.violating_dates).toContain('2026-03-03 & 2026-03-04')
    })

    it('Selasa + Kamis lolos (ada Rabu di antaranya, jarak 1 hari kerja)', () => {
      // 2026-03-03 (Selasa), 2026-03-05 (Kamis)
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
      })
      const res = noConsecutiveDays({ min_gap_working_days: 1 }, ctx)
      expect(res.passed).toBe(true)
    })

    it('Jumat lalu Senin berikutnya gagal (akhir pekan bukan hari kerja sehingga jaraknya nol)', () => {
      // 2026-03-06 (Jumat), 2026-03-09 (Senin)
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
      })
      const res = noConsecutiveDays({ min_gap_working_days: 1 }, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.violating_dates).toContain('2026-03-06 & 2026-03-09')
    })

    it('Bertetangga dengan WFA lama yang sudah disetujui (Kamis sudah disetujui, ajukan Jumat) -> gagal', () => {
      // 2026-03-05 (Kamis - approved), 2026-03-06 (Jumat - new request)
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-06',
          endDate: '2026-03-06',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-06', isWorkingDay: true, dayValue: 1 }],
        },
        usage: {
          daysByWeek: {},
          daysByMonth: {},
          daysThisYear: 1,
          requestsThisMonth: 1,
          approvedDates: ['2026-03-05'],
          hasPreviousRequestEver: true,
          previousRequestNumber: 'REQ/2026/001',
          overlappingRequestNumber: null,
          teamOnLeaveByDate: {},
        },
      })
      const res = noConsecutiveDays({ min_gap_working_days: 1 }, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.violating_dates).toContain('2026-03-05 & 2026-03-06')
    })
  })

  describe('ALLOWED_WEEKDAYS', () => {
    const weekdaysConfig = { weekdays: [2, 3, 4] } // Selasa, Rabu, Kamis

    it('Senin gagal jika hanya Selasa-Kamis yang diizinkan', () => {
      // 2026-03-02 adalah Senin (ISO 1)
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-02',
          endDate: '2026-03-02',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-02', isWorkingDay: true, dayValue: 1 }],
        },
      })
      const res = allowedWeekdays(weekdaysConfig, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.violating_dates).toContain('2026-03-02')
    })

    it('Rabu lolos jika hanya Selasa-Kamis yang diizinkan', () => {
      // 2026-03-04 adalah Rabu (ISO 3)
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
      })
      const res = allowedWeekdays(weekdaysConfig, ctx)
      expect(res.passed).toBe(true)
    })
  })

  describe('MIN_NOTICE_DAYS', () => {
    it('Mode WORKING melompati akhir pekan', () => {
      // Today adalah Jumat 2026-03-06
      // Mulai cuti Senin 2026-03-09 -> notice adalah 1 hari kerja (Jumat)
      const ctx = createMockRuleContext({
        today: '2026-03-06',
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-09',
          endDate: '2026-03-09',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-09', isWorkingDay: true, dayValue: 1 }],
        },
      })

      // Jika butuh 1 hari kerja sebelumnya -> lolos (aktual: 1)
      const passRes = minNoticeDays({ min_notice_days: 1, count: 'WORKING' }, ctx)
      expect(passRes.passed).toBe(true)
      expect(passRes.context.actual_notice_days).toBe(1)

      // Jika butuh 2 hari kerja sebelumnya -> gagal (aktual: 1 karena Sabtu-Minggu bukan hari kerja)
      const failRes = minNoticeDays({ min_notice_days: 2, count: 'WORKING' }, ctx)
      expect(failRes.passed).toBe(false)
      expect(failRes.context.actual_notice_days).toBe(1)
    })

    it('Mode WORKING melompati hari libur nasional', () => {
      // Today adalah Rabu 2026-03-04, libur pada Kamis 2026-03-05
      // Mulai Jumat 2026-03-06 -> notice hari kerja hanya Rabu (1 hari kerja)
      const ctx = createMockRuleContext({
        today: '2026-03-04',
        holidays: ['2026-03-05'],
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-06',
          endDate: '2026-03-06',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-06', isWorkingDay: true, dayValue: 1 }],
        },
      })

      const res = minNoticeDays({ min_notice_days: 2, count: 'WORKING' }, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.actual_notice_days).toBe(1)
    })
  })

  describe('MAX_BACKDATE_DAYS', () => {
    const config = { max_backdate_days: 2 }

    it('Mundur 1 hari lolos jika batas 2', () => {
      const ctx = createMockRuleContext({
        today: '2026-03-05',
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-04',
          endDate: '2026-03-04',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-04', isWorkingDay: true, dayValue: 1 }],
        },
      })
      const res = maxBackdateDays(config, ctx)
      expect(res.passed).toBe(true)
      expect(res.context.backdate_days).toBe(1)
    })

    it('Mundur 3 hari gagal jika batas 2', () => {
      const ctx = createMockRuleContext({
        today: '2026-03-05',
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-02',
          endDate: '2026-03-02',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-02', isWorkingDay: true, dayValue: 1 }],
        },
      })
      const res = maxBackdateDays(config, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.backdate_days).toBe(3)
    })

    it('Tanggal masa depan lolos (backdate_days = 0)', () => {
      const ctx = createMockRuleContext({
        today: '2026-03-05',
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-03-10',
          endDate: '2026-03-10',
          totalDays: 1,
          workingDays: 1,
          attachmentCount: 0,
          days: [{ date: '2026-03-10', isWorkingDay: true, dayValue: 1 }],
        },
      })
      const res = maxBackdateDays(config, ctx)
      expect(res.passed).toBe(true)
      expect(res.context.backdate_days).toBe(0)
    })
  })

  describe('BLACKOUT_PERIOD', () => {
    const config = {
      ranges: [{ from: '2026-12-20', to: '2026-12-31' }],
    }

    it('Pengajuan dalam masa tutup buku -> gagal', () => {
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-12-22',
          endDate: '2026-12-24',
          totalDays: 3,
          workingDays: 3,
          attachmentCount: 0,
          days: [
            { date: '2026-12-22', isWorkingDay: true, dayValue: 1 },
            { date: '2026-12-23', isWorkingDay: true, dayValue: 1 },
            { date: '2026-12-24', isWorkingDay: true, dayValue: 1 },
          ],
        },
      })
      const res = blackoutPeriod(config, ctx)
      expect(res.passed).toBe(false)
      expect(res.context.violating_dates).toContain('2026-12-22')
    })

    it('Pengajuan di luar periode blackout -> lolos', () => {
      const ctx = createMockRuleContext({
        request: {
          leaveTypeId: 'lt-1',
          startDate: '2026-11-10',
          endDate: '2026-11-12',
          totalDays: 3,
          workingDays: 3,
          attachmentCount: 0,
          days: [
            { date: '2026-11-10', isWorkingDay: true, dayValue: 1 },
            { date: '2026-11-11', isWorkingDay: true, dayValue: 1 },
            { date: '2026-11-12', isWorkingDay: true, dayValue: 1 },
          ],
        },
      })
      const res = blackoutPeriod(config, ctx)
      expect(res.passed).toBe(true)
    })
  })
})
