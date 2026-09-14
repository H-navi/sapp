import type { RequestContext, WorkflowSnapshot, WorkflowStepSnapshot } from '../../server/services/approval/types'

export function createMockRequestContext(overrides?: Partial<RequestContext>): RequestContext {
  return {
    id: 'req-001',
    requestNumber: 'REQ/2026/001',
    leaveTypeId: 'lt-wfa',
    totalDays: 1,
    workingDays: 1,
    startDate: '2026-03-10',
    endDate: '2026-03-10',
    employee: {
      id: 'emp-budi',
      fullName: 'Budi Santoso',
      departmentId: 'dept-it',
      positionId: 'pos-staf',
      positionLevel: 1,
      managerId: 'emp-andi',
      employmentStatus: 'PERMANENT',
      ...overrides?.employee,
    },
    ...overrides,
  }
}

export function createMockWorkflowStep(overrides?: Partial<WorkflowStepSnapshot>): WorkflowStepSnapshot {
  return {
    id: 'step-1',
    workflowId: 'wf-1',
    stepOrder: 1,
    name: 'Atasan Langsung',
    approverType: 'DIRECT_MANAGER',
    approvalMode: 'ANY_ONE',
    quorumCount: null,
    isOptional: false,
    skipIfRequester: true,
    skipIfAlreadyApproved: true,
    conditionMinDays: null,
    conditionExpression: null,
    slaHours: 8,
    slaUsesWorkingHours: true,
    reminderEnabled: true,
    reminderIntervalMinutes: 120,
    reminderMaxCount: 5,
    reminderChannels: ['EMAIL', 'TELEGRAM'],
    escalationAction: 'AUTO_APPROVE',
    escalateToStepOrder: null,
    escalationNotifyAdmin: true,
    allowDelegation: true,
    ...overrides,
  }
}

export function createMockWorkflow(overrides?: Partial<WorkflowSnapshot>): WorkflowSnapshot {
  return {
    id: 'wf-wfa',
    code: 'WF_WFA',
    name: 'Alur WFA',
    priority: 10,
    version: 1,
    steps: [createMockWorkflowStep()],
    ...overrides,
  }
}
