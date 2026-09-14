import type { RuleContext } from '../../server/services/rules/types'

export function createMockRuleContext(overrides?: Partial<RuleContext>): RuleContext {
  return {
    request: {
      id: 'req-1',
      leaveTypeId: 'lt-1',
      startDate: '2026-03-09',
      endDate: '2026-03-09',
      totalDays: 1,
      workingDays: 1,
      attachmentCount: 0,
      days: [
        {
          date: '2026-03-09',
          isWorkingDay: true,
          dayValue: 1,
        },
      ],
      ...overrides?.request,
    },
    employee: {
      id: 'emp-1',
      name: 'Budi Santoso',
      gender: 'MALE',
      employmentStatus: 'PERMANENT',
      joinDate: '2024-01-01',
      departmentId: 'dept-1',
      employmentMonths: 26,
      ...overrides?.employee,
    },
    leaveType: {
      code: 'CUTI_TAHUNAN',
      name: 'Cuti Tahunan',
      countsWorkingDaysOnly: true,
      ...overrides?.leaveType,
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
      teamOnLeaveByDate: {},
      ...overrides?.usage,
    },
    quota: {
      balance: 12,
      allocated: 12,
      used: 0,
      reserved: 0,
      ...overrides?.quota,
    },
    today: '2026-03-02',
    holidays: [],
    ...overrides,
  }
}
