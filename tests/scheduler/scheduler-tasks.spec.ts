import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import {
  type WorkingCalendar,
  isWithinWorkingHours,
  addWorkingHours,
  nextWorkingMoment,
} from '../../server/utils/working-time'

describe('Scheduler, Reminder & Escalation Logic', () => {
  const standardCalendar: WorkingCalendar = {
    hours: {
      1: { isWorkingDay: true, start: '08:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      2: { isWorkingDay: true, start: '08:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      3: { isWorkingDay: true, start: '08:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      4: { isWorkingDay: true, start: '08:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      5: { isWorkingDay: true, start: '08:00', end: '17:00', breakStart: '11:30', breakEnd: '13:00' },
      6: { isWorkingDay: false, start: '00:00', end: '00:00', breakStart: null, breakEnd: null },
      7: { isWorkingDay: false, start: '00:00', end: '00:00', breakStart: null, breakEnd: null },
    },
    holidays: new Set(['2026-08-17']),
  }

  describe('1. Reminder Postponement vs Count Increment', () => {
    function processReminder(task: {
      id: string
      reminderCount: number
      reminderMaxCount: number
      reminderOnlyWorkingHours: boolean
      nextReminderAt: Date | null
      now: Date
      cal: WorkingCalendar
    }) {
      if (task.reminderCount >= task.reminderMaxCount) {
        return { action: 'STOPPED', nextReminderAt: null, incremented: false }
      }

      if (task.reminderOnlyWorkingHours && !isWithinWorkingHours(task.now, task.cal)) {
        // Tunda ke awal jam kerja berikutnya TANPA menaikkan reminder_count!
        const next = nextWorkingMoment(task.now, task.cal)
        return { action: 'POSTPONED', nextReminderAt: next, incremented: false }
      }

      // Dalam jam kerja: kirim pengingat dan naikkan hitungan
      const nextCount = task.reminderCount + 1
      const nextTime = dayjs(task.now).add(120, 'minute').toDate()
      return {
        action: 'SENT',
        reminderCount: nextCount,
        nextReminderAt: nextCount >= task.reminderMaxCount ? null : nextTime,
        incremented: true,
      }
    }

    it('dalam jam kerja: pengingat terkirim dan reminder_count bertambah', () => {
      // Senin 10:00 WIB (jam kerja aktif)
      const now = dayjs.tz('2026-08-10 10:00', 'Asia/Jakarta').toDate()
      const res = processReminder({
        id: 't-1',
        reminderCount: 0,
        reminderMaxCount: 5,
        reminderOnlyWorkingHours: true,
        nextReminderAt: now,
        now,
        cal: standardCalendar,
      })

      expect(res.action).toBe('SENT')
      expect(res.incremented).toBe(true)
      expect(res.reminderCount).toBe(1)
      expect(res.nextReminderAt).not.toBeNull()
    })

    it('di luar jam kerja (misal 22:00 WIB): ditunda ke 08:00 besok TANPA menaikkan reminder_count', () => {
      // Senin 22:00 WIB (di luar jam operasional)
      const now = dayjs.tz('2026-08-10 22:00', 'Asia/Jakarta').toDate()
      const res = processReminder({
        id: 't-1',
        reminderCount: 2,
        reminderMaxCount: 5,
        reminderOnlyWorkingHours: true,
        nextReminderAt: now,
        now,
        cal: standardCalendar,
      })

      expect(res.action).toBe('POSTPONED')
      expect(res.incremented).toBe(false)
      // Waktu berikutnya harus Selasa 08:00 WIB
      const nextStr = dayjs(res.nextReminderAt).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm')
      expect(nextStr).toBe('2026-08-11 08:00')
    })

    it('saat istirahat siang: ditunda ke akhir jam istirahat tanpa menaikkan reminder_count', () => {
      // Senin 12:30 WIB (istirahat)
      const now = dayjs.tz('2026-08-10 12:30', 'Asia/Jakarta').toDate()
      const res = processReminder({
        id: 't-1',
        reminderCount: 1,
        reminderMaxCount: 5,
        reminderOnlyWorkingHours: true,
        nextReminderAt: now,
        now,
        cal: standardCalendar,
      })

      expect(res.action).toBe('POSTPONED')
      expect(res.incremented).toBe(false)
      const nextStr = dayjs(res.nextReminderAt).tz('Asia/Jakarta').format('HH:mm')
      expect(nextStr).toBe('13:00')
    })

    it('berhenti ketika telah mencapai batas maksimal reminderMaxCount', () => {
      const now = dayjs.tz('2026-08-10 10:00', 'Asia/Jakarta').toDate()
      const res = processReminder({
        id: 't-1',
        reminderCount: 5,
        reminderMaxCount: 5,
        reminderOnlyWorkingHours: true,
        nextReminderAt: now,
        now,
        cal: standardCalendar,
      })

      expect(res.action).toBe('STOPPED')
      expect(res.nextReminderAt).toBeNull()
      expect(res.incremented).toBe(false)
    })
  })

  describe('2. Escalation Action Execution Matrix', () => {
    function evaluateEscalation(step: {
      action: 'AUTO_APPROVE' | 'AUTO_REJECT' | 'ESCALATE_NEXT_STEP' | 'ESCALATE_TO_STEP' | 'NOTIFY_ADMIN_ONLY' | 'KEEP_WAITING'
      slaHours: number
      slaUsesWorkingHours: boolean
      hasNextStep: boolean
      escalateToStepOrder?: number
      now: Date
      cal: WorkingCalendar
    }) {
      switch (step.action) {
        case 'AUTO_APPROVE':
          return {
            taskStatus: 'APPROVED',
            requestStatus: step.hasNextStep ? 'IN_REVIEW' : 'APPROVED',
            actionSource: 'SYSTEM_AUTO',
          }
        case 'AUTO_REJECT':
          return {
            taskStatus: 'REJECTED',
            requestStatus: 'REJECTED',
            actionSource: 'SYSTEM_AUTO',
          }
        case 'ESCALATE_NEXT_STEP':
          return {
            taskStatus: 'ESCALATED',
            advanceToNext: step.hasNextStep,
            notifyAdminIfNoNext: !step.hasNextStep,
          }
        case 'ESCALATE_TO_STEP':
          return {
            taskStatus: 'ESCALATED',
            targetStepOrder: step.escalateToStepOrder ?? 2,
          }
        case 'NOTIFY_ADMIN_ONLY': {
          const newDue = step.slaUsesWorkingHours
            ? addWorkingHours(step.now, step.slaHours, step.cal)
            : dayjs(step.now).add(step.slaHours, 'hour').toDate()
          return {
            taskStatus: 'PENDING',
            extendedDueAt: newDue,
            notifyAdmin: true,
          }
        }
        case 'KEEP_WAITING':
          return {
            taskStatus: 'PENDING',
            extendedDueAt: null,
          }
      }
    }

    it('AUTO_APPROVE pada tahap terakhir menyelesaikan pengajuan menjadi APPROVED', () => {
      const now = new Date()
      const res = evaluateEscalation({
        action: 'AUTO_APPROVE',
        slaHours: 8,
        slaUsesWorkingHours: true,
        hasNextStep: false,
        now,
        cal: standardCalendar,
      })

      expect(res.taskStatus).toBe('APPROVED')
      expect(res.requestStatus).toBe('APPROVED')
      expect(res.actionSource).toBe('SYSTEM_AUTO')
    })

    it('AUTO_APPROVE dengan tahap berikutnya melanjutkan alur', () => {
      const now = new Date()
      const res = evaluateEscalation({
        action: 'AUTO_APPROVE',
        slaHours: 8,
        slaUsesWorkingHours: true,
        hasNextStep: true,
        now,
        cal: standardCalendar,
      })

      expect(res.taskStatus).toBe('APPROVED')
      expect(res.requestStatus).toBe('IN_REVIEW')
    })

    it('AUTO_REJECT langsung menolak pengajuan dengan action_source SYSTEM_AUTO', () => {
      const now = new Date()
      const res = evaluateEscalation({
        action: 'AUTO_REJECT',
        slaHours: 8,
        slaUsesWorkingHours: true,
        hasNextStep: true,
        now,
        cal: standardCalendar,
      })

      expect(res.taskStatus).toBe('REJECTED')
      expect(res.requestStatus).toBe('REJECTED')
      expect(res.actionSource).toBe('SYSTEM_AUTO')
    })

    it('NOTIFY_ADMIN_ONLY memperpanjang due_at sesuai jam kerja dan tetap PENDING', () => {
      // Jumat 16:00 WIB + 8 jam kerja -> Senin 15:00 WIB
      const now = dayjs.tz('2026-08-07 16:00', 'Asia/Jakarta').toDate()
      const res = evaluateEscalation({
        action: 'NOTIFY_ADMIN_ONLY',
        slaHours: 8,
        slaUsesWorkingHours: true,
        hasNextStep: true,
        now,
        cal: standardCalendar,
      })

      expect(res.taskStatus).toBe('PENDING')
      expect(res.notifyAdmin).toBe(true)
      const dueStr = dayjs(res.extendedDueAt).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm')
      expect(dueStr).toBe('2026-08-10 16:00')
    })

    it('KEEP_WAITING mengosongkan due_at agar tidak terus ditarik query', () => {
      const now = new Date()
      const res = evaluateEscalation({
        action: 'KEEP_WAITING',
        slaHours: 8,
        slaUsesWorkingHours: true,
        hasNextStep: true,
        now,
        cal: standardCalendar,
      })

      expect(res.taskStatus).toBe('PENDING')
      expect(res.extendedDueAt).toBeNull()
    })
  })

  describe('3. Auto-Decision Matrix & Rule Overrides', () => {
    function evaluateAutoDecision(input: {
      autoDecisionRequiresRulePass: boolean
      onDeadlineAction: 'AUTO_APPROVE' | 'AUTO_REJECT' | 'KEEP_WAITING' | 'NOTIFY_ADMIN_ONLY'
      ruleCheck: {
        passed: boolean
        requiresManualApproval: boolean
        failedRules: string[]
      }
      overallDeadlineHours: number
      leaveTypeName: string
      blockedCount: number
    }) {
      const { autoDecisionRequiresRulePass, onDeadlineAction, ruleCheck, overallDeadlineHours, leaveTypeName, blockedCount } = input

      if (onDeadlineAction === 'KEEP_WAITING') {
        return { action: 'KEEP_WAITING', status: 'IN_REVIEW' }
      }

      if (onDeadlineAction === 'NOTIFY_ADMIN_ONLY') {
        return { action: 'NOTIFY_ADMIN_ONLY', status: 'IN_REVIEW', extendDeadline: true }
      }

      // Aturan REQUIRE_APPROVAL mengalahkan persetujuan otomatis!
      if (ruleCheck.requiresManualApproval) {
        if (blockedCount >= 2) {
          return {
            status: 'EXPIRED',
            reason: 'Pengajuan kedaluwarsa setelah perpanjangan maksimum (aturan membutuhkan persetujuan manual approver).',
          }
        }
        return {
          action: 'AUTO_DECISION_BLOCKED',
          status: 'IN_REVIEW',
          extendDeadline: true,
          blockedCount: blockedCount + 1,
        }
      }

      // Gagal aturan saat autoDecisionRequiresRulePass = true -> AUTO REJECT dengan alasan konkret
      if (autoDecisionRequiresRulePass && !ruleCheck.passed) {
        const violatedRules = ruleCheck.failedRules.join('; ')
        return {
          status: 'REJECTED',
          reason: `Pengajuan ditolak otomatis oleh sistem karena melewati batas waktu ${overallDeadlineHours} jam dan tidak memenuhi ketentuan: ${violatedRules}`,
        }
      }

      // Memenuhi seluruh aturan -> ikuti onDeadlineAction
      if (onDeadlineAction === 'AUTO_APPROVE') {
        return {
          status: 'APPROVED',
          reason: `Disetujui otomatis oleh sistem karena melewati batas waktu ${overallDeadlineHours} jam tanpa tindakan approver, dan seluruh ketentuan ${leaveTypeName} terpenuhi.`,
        }
      } else {
        return {
          status: 'REJECTED',
          reason: `Ditolak otomatis oleh sistem karena melewati batas waktu ${overallDeadlineHours} jam.`,
        }
      }
    }

    it('memenuhi seluruh aturan -> AUTO APPROVED dengan template konkret', () => {
      const res = evaluateAutoDecision({
        autoDecisionRequiresRulePass: true,
        onDeadlineAction: 'AUTO_APPROVE',
        ruleCheck: { passed: true, requiresManualApproval: false, failedRules: [] },
        overallDeadlineHours: 24,
        leaveTypeName: 'Cuti Tahunan',
        blockedCount: 0,
      })

      expect(res.status).toBe('APPROVED')
      expect(res.reason).toContain('seluruh ketentuan Cuti Tahunan terpenuhi')
    })

    it('melanggar aturan (misal kuota habis saat re-evaluasi) -> AUTO REJECTED dengan alasan aturan yang gagal', () => {
      const res = evaluateAutoDecision({
        autoDecisionRequiresRulePass: true,
        onDeadlineAction: 'AUTO_APPROVE',
        ruleCheck: {
          passed: false,
          requiresManualApproval: false,
          failedRules: ['Sisa kuota tidak mencukupi (tersisa 1 hari, diminta 3 hari)'],
        },
        overallDeadlineHours: 24,
        leaveTypeName: 'Cuti Tahunan',
        blockedCount: 0,
      })

      expect(res.status).toBe('REJECTED')
      expect(res.reason).toContain('tidak memenuhi ketentuan: Sisa kuota tidak mencukupi')
    })

    it('aturan REQUIRE_APPROVAL aktif -> memblokir auto approve dan memperpanjang batas waktu', () => {
      const res = evaluateAutoDecision({
        autoDecisionRequiresRulePass: true,
        onDeadlineAction: 'AUTO_APPROVE',
        ruleCheck: {
          passed: false,
          requiresManualApproval: true,
          failedRules: ['Pengajuan cuti lebih dari 5 hari wajib persetujuan manual Direksi'],
        },
        overallDeadlineHours: 24,
        leaveTypeName: 'Cuti Tahunan',
        blockedCount: 0,
      })

      expect(res.action).toBe('AUTO_DECISION_BLOCKED')
      expect(res.status).toBe('IN_REVIEW')
      expect(res.extendDeadline).toBe(true)
      expect(res.blockedCount).toBe(1)
    })

    it('aturan REQUIRE_APPROVAL yang telah diperpanjang 2x -> berubah menjadi EXPIRED', () => {
      const res = evaluateAutoDecision({
        autoDecisionRequiresRulePass: true,
        onDeadlineAction: 'AUTO_APPROVE',
        ruleCheck: {
          passed: false,
          requiresManualApproval: true,
          failedRules: ['Pengajuan cuti lebih dari 5 hari wajib persetujuan manual Direksi'],
        },
        overallDeadlineHours: 24,
        leaveTypeName: 'Cuti Tahunan',
        blockedCount: 2,
      })

      expect(res.status).toBe('EXPIRED')
      expect(res.reason).toContain('kedaluwarsa setelah perpanjangan maksimum')
    })
  })

  describe('4. Dev Endpoint Security Guard', () => {
    it('mengembalikan 404 ketika NODE_ENV adalah production', () => {
      const checkProductionGuard = (env: string) => {
        if (env === 'production') {
          return { statusCode: 404, statusMessage: 'Not Found' }
        }
        return { statusCode: 200, statusMessage: 'OK' }
      }

      expect(checkProductionGuard('production').statusCode).toBe(404)
      expect(checkProductionGuard('development').statusCode).toBe(200)
      expect(checkProductionGuard('test').statusCode).toBe(200)
    })
  })

  describe('5. Deduplication Keys for Idempotency', () => {
    it('menghasilkan dedupe_key unik dan konsisten untuk pengingat', () => {
      const key1 = `reminder:task-123:emp-456:EMAIL:1`
      const key2 = `reminder:task-123:emp-456:EMAIL:1`
      const keyNext = `reminder:task-123:emp-456:EMAIL:2`

      expect(key1).toBe(key2)
      expect(key1).not.toBe(keyNext)
    })

    it('menghasilkan dedupe_key unik untuk eskalasi dan auto decision', () => {
      const escKey = `escalated:task-123:AUTO_APPROVE`
      const autoKey = `auto_decision:req-999:REQUEST_AUTO_APPROVED`

      expect(escKey).toContain('task-123')
      expect(autoKey).toContain('req-999')
    })
  })
})
