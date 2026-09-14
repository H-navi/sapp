import { relations } from 'drizzle-orm'

export * from './enums'
export * from './org'
export * from './auth'
export * from './leave-types'
export * from './policies'
export * from './quotas'
export * from './workflows'
export * from './requests'
export * from './approvals'
export * from './notifications'
export * from './system'

import { departments, positions, employees } from './org'
import { users, roles, userRoles, rolePermissions, permissions, userSessions } from './auth'
import { leaveTypes, leaveTypeEligibilities } from './leave-types'
import { leavePolicies, leavePolicyRules } from './policies'
import { leaveQuotas, leaveQuotaLedger } from './quotas'
import { approvalWorkflows, approvalWorkflowSteps, approvalDelegations } from './workflows'
import { leaveRequests, leaveRequestDays, leaveRequestAttachments, leaveRequestRuleChecks } from './requests'
import { approvalTasks, approvalTaskAssignees, approvalHistories } from './approvals'
import { notifications, inAppNotifications } from './notifications'

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  parent: one(departments, { fields: [departments.parentId], references: [departments.id], relationName: 'department_parent' }),
  children: many(departments, { relationName: 'department_parent' }),
  headEmployee: one(employees, { fields: [departments.headEmployeeId], references: [employees.id] }),
  employees: many(employees),
}))

export const positionsRelations = relations(positions, ({ many }) => ({
  employees: many(employees),
}))

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  position: one(positions, { fields: [employees.positionId], references: [positions.id] }),
  manager: one(employees, { fields: [employees.managerId], references: [employees.id], relationName: 'employee_manager' }),
  subordinates: many(employees, { relationName: 'employee_manager' }),
  user: one(users, { fields: [employees.id], references: [users.employeeId] }),
  quotas: many(leaveQuotas),
  requests: many(leaveRequests),
  assignedTasks: many(approvalTaskAssignees),
  notifications: many(inAppNotifications),
  delegationsGiven: many(approvalDelegations, { relationName: 'delegator' }),
  delegationsReceived: many(approvalDelegations, { relationName: 'delegate' }),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  employee: one(employees, { fields: [users.employeeId], references: [employees.id] }),
  userRoles: many(userRoles),
  sessions: many(userSessions),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  department: one(departments, { fields: [userRoles.scopeDepartmentId], references: [departments.id] }),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}))

export const leaveTypesRelations = relations(leaveTypes, ({ many }) => ({
  eligibilities: many(leaveTypeEligibilities),
  policies: many(leavePolicies),
  quotas: many(leaveQuotas),
  requests: many(leaveRequests),
  workflows: many(approvalWorkflows),
}))

export const leavePoliciesRelations = relations(leavePolicies, ({ one, many }) => ({
  leaveType: one(leaveTypes, { fields: [leavePolicies.leaveTypeId], references: [leaveTypes.id] }),
  rules: many(leavePolicyRules),
}))

export const leavePolicyRulesRelations = relations(leavePolicyRules, ({ one }) => ({
  policy: one(leavePolicies, { fields: [leavePolicyRules.policyId], references: [leavePolicies.id] }),
}))

export const leaveQuotasRelations = relations(leaveQuotas, ({ one, many }) => ({
  employee: one(employees, { fields: [leaveQuotas.employeeId], references: [employees.id] }),
  leaveType: one(leaveTypes, { fields: [leaveQuotas.leaveTypeId], references: [leaveTypes.id] }),
  ledger: many(leaveQuotaLedger),
}))

export const leaveQuotaLedgerRelations = relations(leaveQuotaLedger, ({ one }) => ({
  quota: one(leaveQuotas, { fields: [leaveQuotaLedger.quotaId], references: [leaveQuotas.id] }),
  request: one(leaveRequests, { fields: [leaveQuotaLedger.requestId], references: [leaveRequests.id] }),
}))

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({ one, many }) => ({
  leaveType: one(leaveTypes, { fields: [approvalWorkflows.leaveTypeId], references: [leaveTypes.id] }),
  department: one(departments, { fields: [approvalWorkflows.departmentId], references: [departments.id] }),
  steps: many(approvalWorkflowSteps),
  requests: many(leaveRequests),
}))

export const approvalWorkflowStepsRelations = relations(approvalWorkflowSteps, ({ one, many }) => ({
  workflow: one(approvalWorkflows, { fields: [approvalWorkflowSteps.workflowId], references: [approvalWorkflows.id] }),
  position: one(positions, { fields: [approvalWorkflowSteps.approverPositionId], references: [positions.id] }),
  employee: one(employees, { fields: [approvalWorkflowSteps.approverEmployeeId], references: [employees.id] }),
  role: one(roles, { fields: [approvalWorkflowSteps.approverRoleId], references: [roles.id] }),
  tasks: many(approvalTasks),
}))

export const leaveRequestsRelations = relations(leaveRequests, ({ one, many }) => ({
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id] }),
  leaveType: one(leaveTypes, { fields: [leaveRequests.leaveTypeId], references: [leaveTypes.id] }),
  policy: one(leavePolicies, { fields: [leaveRequests.policyId], references: [leavePolicies.id] }),
  workflow: one(approvalWorkflows, { fields: [leaveRequests.workflowId], references: [approvalWorkflows.id] }),
  delegate: one(employees, { fields: [leaveRequests.delegateEmployeeId], references: [employees.id] }),
  decidedByEmployee: one(employees, { fields: [leaveRequests.decidedBy], references: [employees.id] }),
  days: many(leaveRequestDays),
  attachments: many(leaveRequestAttachments),
  ruleChecks: many(leaveRequestRuleChecks),
  tasks: many(approvalTasks),
  histories: many(approvalHistories),
  notifications: many(notifications),
}))

export const leaveRequestDaysRelations = relations(leaveRequestDays, ({ one }) => ({
  request: one(leaveRequests, { fields: [leaveRequestDays.requestId], references: [leaveRequests.id] }),
}))

export const leaveRequestAttachmentsRelations = relations(leaveRequestAttachments, ({ one }) => ({
  request: one(leaveRequests, { fields: [leaveRequestAttachments.requestId], references: [leaveRequests.id] }),
}))

export const leaveRequestRuleChecksRelations = relations(leaveRequestRuleChecks, ({ one }) => ({
  request: one(leaveRequests, { fields: [leaveRequestRuleChecks.requestId], references: [leaveRequests.id] }),
  rule: one(leavePolicyRules, { fields: [leaveRequestRuleChecks.ruleId], references: [leavePolicyRules.id] }),
}))

export const approvalTasksRelations = relations(approvalTasks, ({ one, many }) => ({
  request: one(leaveRequests, { fields: [approvalTasks.requestId], references: [leaveRequests.id] }),
  workflowStep: one(approvalWorkflowSteps, { fields: [approvalTasks.workflowStepId], references: [approvalWorkflowSteps.id] }),
  assignees: many(approvalTaskAssignees),
  histories: many(approvalHistories),
}))

export const approvalTaskAssigneesRelations = relations(approvalTaskAssignees, ({ one }) => ({
  task: one(approvalTasks, { fields: [approvalTaskAssignees.taskId], references: [approvalTasks.id] }),
  employee: one(employees, { fields: [approvalTaskAssignees.employeeId], references: [employees.id] }),
  delegatedFromEmployee: one(employees, { fields: [approvalTaskAssignees.delegatedFrom], references: [employees.id] }),
}))

export const approvalHistoriesRelations = relations(approvalHistories, ({ one }) => ({
  request: one(leaveRequests, { fields: [approvalHistories.requestId], references: [leaveRequests.id] }),
  task: one(approvalTasks, { fields: [approvalHistories.taskId], references: [approvalTasks.id] }),
  actorEmployee: one(employees, { fields: [approvalHistories.actorEmployeeId], references: [employees.id] }),
}))

export const approvalDelegationsRelations = relations(approvalDelegations, ({ one }) => ({
  delegator: one(employees, { fields: [approvalDelegations.delegatorEmployeeId], references: [employees.id], relationName: 'delegator' }),
  delegate: one(employees, { fields: [approvalDelegations.delegateEmployeeId], references: [employees.id], relationName: 'delegate' }),
  leaveType: one(leaveTypes, { fields: [approvalDelegations.leaveTypeId], references: [leaveTypes.id] }),
}))
