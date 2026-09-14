import { describe, it, expect } from 'vitest'
import { renderMessage, baseVars } from '../../server/services/rules/message'
import { createMockRuleContext } from './helpers'
import type { RuleDetail, RuleCheckResult } from '../../server/services/rules/types'

describe('Rule Engine Orchestration & Message Rendering', () => {
  it('renderMessage: mengganti placeholder dengan benar dan aman', () => {
    const template = 'Pengajuan {{requested_days}} hari melebihi batas {{max_days}} hari per {{period}}.'
    const vars = {
      requested_days: 4,
      max_days: 2,
      period: 'WEEK',
    }
    const res = renderMessage(template, vars)
    expect(res).toBe('Pengajuan 4 hari melebihi batas 2 hari per WEEK.')
  })

  it('renderMessage: menangani placeholder kosong / tidak ada dengan -', () => {
    const template = 'Info: {{unknown_key}}.'
    const res = renderMessage(template, {})
    expect(res).toBe('Info: -.')
  })

  it('baseVars: menyediakan variabel umum dari RuleContext', () => {
    const ctx = createMockRuleContext({
      employee: {
        id: 'emp-1',
        name: 'Siti Rahma',
        gender: 'FEMALE',
        employmentStatus: 'PERMANENT',
        joinDate: '2024-01-01',
        departmentId: 'dept-1',
        employmentMonths: 24,
      },
      leaveType: {
        code: 'WFA',
        name: 'Work From Anywhere',
        countsWorkingDaysOnly: true,
      },
    })
    const vars = baseVars(ctx)
    expect(vars.employee_name).toBe('Siti Rahma')
    expect(vars.leave_type_name).toBe('Work From Anywhere')
    expect(vars.employment_status).toBe('PERMANENT')
  })

  it('Fail-Safe & Pemilahan Aksi Pelanggaran', () => {
    // Simulasikan hasil evaluasi rule
    const details: RuleDetail[] = [
      {
        ruleId: 'r-1',
        ruleCode: 'WFA_MAKS_PER_AJU',
        ruleType: 'MAX_DAYS_PER_REQUEST',
        passed: false,
        violationAction: 'BLOCK_SUBMIT',
        message: 'Maksimal 1 hari per pengajuan WFA',
        context: {},
      },
      {
        ruleId: 'r-2',
        ruleCode: 'WFA_TIDAK_BERURUTAN',
        ruleType: 'NO_CONSECUTIVE_DAYS',
        passed: false,
        violationAction: 'AUTO_REJECT',
        message: 'Tidak boleh berurutan',
        context: {},
      },
      {
        ruleId: 'r-3',
        ruleCode: 'WFA_KAPASITAS',
        ruleType: 'MAX_CONCURRENT_TEAM_ON_LEAVE',
        passed: false,
        violationAction: 'REQUIRE_APPROVAL',
        message: 'Kapasitas tim penuh, butuh persetujuan manual',
        context: {},
      },
      {
        ruleId: 'r-4',
        ruleCode: 'WFA_PERINGATAN',
        ruleType: 'CUSTOM_EXPRESSION',
        passed: false,
        violationAction: 'WARN_ONLY',
        message: 'Peringatan saja',
        context: {},
      },
      {
        ruleId: 'r-5',
        ruleCode: 'WFA_STATUS',
        ruleType: 'EMPLOYMENT_STATUS_ALLOWED',
        passed: true,
        violationAction: null,
        message: '',
        context: {},
      },
    ]

    const gagal = details.filter((d) => !d.passed)
    const summary: RuleCheckResult = {
      passed: gagal.length === 0,
      blockingMessages: gagal.filter((d) => d.violationAction === 'BLOCK_SUBMIT').map((d) => d.message),
      autoRejectMessages: gagal.filter((d) => d.violationAction === 'AUTO_REJECT').map((d) => d.message),
      requiresManualApproval: gagal.some((d) => d.violationAction === 'REQUIRE_APPROVAL'),
      warnings: gagal.filter((d) => d.violationAction === 'WARN_ONLY').map((d) => d.message),
      details,
    }

    expect(summary.passed).toBe(false)
    expect(summary.blockingMessages).toContain('Maksimal 1 hari per pengajuan WFA')
    expect(summary.autoRejectMessages).toContain('Tidak boleh berurutan')
    expect(summary.requiresManualApproval).toBe(true)
    expect(summary.warnings).toContain('Peringatan saja')
  })
})
