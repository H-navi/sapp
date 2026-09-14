export interface RequestContext {
  id: string
  requestNumber: string
  leaveTypeId: string
  totalDays: number
  workingDays: number
  startDate: string
  endDate: string
  employee: {
    id: string
    fullName: string
    departmentId: string | null
    positionId: string | null
    positionLevel: number | null
    managerId: string | null
    employmentStatus: string
  }
}

export interface WorkflowStepSnapshot {
  id: string
  workflowId: string
  stepOrder: number
  name: string
  approverType:
    | 'DIRECT_MANAGER'
    | 'POSITION_LEVEL'
    | 'POSITION'
    | 'DEPARTMENT_HEAD'
    | 'SPECIFIC_EMPLOYEE'
    | 'ROLE'
    | 'HR_DEPARTMENT'
  approverPositionId?: string | null
  approverPositionLevel?: number | null
  approverEmployeeId?: string | null
  approverRoleId?: string | null
  approvalMode: 'ANY_ONE' | 'ALL' | 'QUORUM'
  quorumCount?: number | null
  isOptional: boolean
  skipIfRequester: boolean
  skipIfAlreadyApproved: boolean
  conditionMinDays?: number | string | null
  conditionExpression?: any
  slaHours: number
  slaUsesWorkingHours: boolean
  reminderEnabled: boolean
  reminderIntervalMinutes: number
  reminderMaxCount: number
  reminderChannels: string[]
  escalationAction: string
  escalateToStepOrder?: number | null
  escalationNotifyAdmin: boolean
  allowDelegation: boolean
}

export interface WorkflowSnapshot {
  id: string
  code: string
  name: string
  description?: string | null
  leaveTypeId?: string | null
  departmentId?: string | null
  priority: number
  version: number
  steps: WorkflowStepSnapshot[]
}

export interface ApproverCandidate {
  employeeId: string
  fullName?: string
  isDelegate: boolean
  delegatedFrom: string | null
}

export interface TaskActionResult {
  success: boolean
  stepCompleted: boolean
  requestStatus: string
  message: string
}
