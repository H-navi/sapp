import { describe, it, expect } from 'vitest'
import {
  genderRestriction,
  minEmploymentMonths,
  employmentStatusAllowed,
  oncePerEmployment,
} from '../../server/services/rules/evaluators/eligibility'
import { createMockRuleContext } from './helpers'

describe('Eligibility Rule Evaluators', () => {
  it('GENDER_RESTRICTION: pegawai perempuan mengajukan cuti melahirkan -> lolos', () => {
    const ctx = createMockRuleContext({
      employee: {
        id: 'emp-f',
        gender: 'FEMALE',
        employmentStatus: 'PERMANENT',
        joinDate: '2024-01-01',
        departmentId: 'dept-1',
        employmentMonths: 24,
      },
    })
    const res = genderRestriction({ gender: 'FEMALE' }, ctx)
    expect(res.passed).toBe(true)
  })

  it('GENDER_RESTRICTION: pegawai laki-laki mengajukan cuti melahirkan -> gagal', () => {
    const ctx = createMockRuleContext({
      employee: {
        id: 'emp-m',
        gender: 'MALE',
        employmentStatus: 'PERMANENT',
        joinDate: '2024-01-01',
        departmentId: 'dept-1',
        employmentMonths: 24,
      },
    })
    const res = genderRestriction({ gender: 'FEMALE' }, ctx)
    expect(res.passed).toBe(false)
    expect(res.context.actual_gender).toBe('MALE')
  })

  it('MIN_EMPLOYMENT_MONTHS: masa kerja 14 bulan untuk syarat 12 bulan -> lolos', () => {
    const ctx = createMockRuleContext({
      employee: {
        id: 'emp-1',
        gender: 'MALE',
        employmentStatus: 'PERMANENT',
        joinDate: '2025-01-01',
        departmentId: 'dept-1',
        employmentMonths: 14,
      },
    })
    const res = minEmploymentMonths({ months: 12 }, ctx)
    expect(res.passed).toBe(true)
    expect(res.context.actual_months).toBe(14)
  })

  it('MIN_EMPLOYMENT_MONTHS: masa kerja 8 bulan untuk syarat 12 bulan -> gagal', () => {
    const ctx = createMockRuleContext({
      employee: {
        id: 'emp-1',
        gender: 'MALE',
        employmentStatus: 'PERMANENT',
        joinDate: '2025-07-01',
        departmentId: 'dept-1',
        employmentMonths: 8,
      },
    })
    const res = minEmploymentMonths({ months: 12 }, ctx)
    expect(res.passed).toBe(false)
    expect(res.context.actual_months).toBe(8)
  })

  it('EMPLOYMENT_STATUS_ALLOWED: lolos jika status termasuk dalam daftar yang diizinkan', () => {
    const ctx = createMockRuleContext({
      employee: {
        id: 'emp-1',
        gender: 'MALE',
        employmentStatus: 'PERMANENT',
        joinDate: '2025-01-01',
        departmentId: 'dept-1',
        employmentMonths: 14,
      },
    })
    const res = employmentStatusAllowed({ statuses: ['PERMANENT', 'CONTRACT'] }, ctx)
    expect(res.passed).toBe(true)
  })

  it('EMPLOYMENT_STATUS_ALLOWED: gagal jika status (INTERN) tidak diizinkan', () => {
    const ctx = createMockRuleContext({
      employee: {
        id: 'emp-1',
        gender: 'MALE',
        employmentStatus: 'INTERN',
        joinDate: '2025-01-01',
        departmentId: 'dept-1',
        employmentMonths: 2,
      },
    })
    const res = employmentStatusAllowed({ statuses: ['PERMANENT', 'CONTRACT'] }, ctx)
    expect(res.passed).toBe(false)
  })

  it('ONCE_PER_EMPLOYMENT: pengajuan pertama lolos', () => {
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
    const res = oncePerEmployment({}, ctx)
    expect(res.passed).toBe(true)
  })

  it('ONCE_PER_EMPLOYMENT: pengajuan kedua gagal', () => {
    const ctx = createMockRuleContext({
      usage: {
        daysByWeek: {},
        daysByMonth: {},
        daysThisYear: 3,
        requestsThisMonth: 0,
        approvedDates: [],
        hasPreviousRequestEver: true,
        previousRequestNumber: 'REQ/2025/088',
        overlappingRequestNumber: null,
        teamOnLeaveByDate: {},
      },
    })
    const res = oncePerEmployment({}, ctx)
    expect(res.passed).toBe(false)
    expect(res.context.previous_request_number).toBe('REQ/2025/088')
  })
})
