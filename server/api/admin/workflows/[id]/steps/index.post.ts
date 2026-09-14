import { requirePermission } from '~~/server/utils/guard'
import { workflowStepInputSchema } from '~~/server/validators/admin'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const workflowId = getRouterParam(event, 'id')
  if (!workflowId) {
    throw createError({ statusCode: 400, message: 'ID alur persetujuan wajib diisi' })
  }

  const body = await readValidatedBody(event, workflowStepInputSchema.parse)
  const db = useDatabase()

  const [inserted] = await db
    .insert(schema.approvalWorkflowSteps)
    .values({
      workflowId,
      stepOrder: body.stepOrder,
      name: body.name,
      approverType: body.approverType as any,
      approverPositionId: body.approverPositionId,
      approverPositionLevel: body.approverPositionLevel,
      approverEmployeeId: body.approverEmployeeId,
      approverRoleId: body.approverRoleId,
      approvalMode: body.approvalMode as any,
      quorumCount: body.quorumCount,
      isOptional: body.isOptional,
      skipIfRequester: body.skipIfRequester,
      skipIfAlreadyApproved: body.skipIfAlreadyApproved,
      conditionMinDays: body.conditionMinDays ? String(body.conditionMinDays) : null,
      slaHours: String(body.slaHours),
      slaUsesWorkingHours: body.slaUsesWorkingHours,
      reminderEnabled: body.reminderEnabled,
      reminderIntervalMinutes: body.reminderIntervalMinutes,
      reminderMaxCount: body.reminderMaxCount,
      escalationAction: body.escalationAction as any,
      escalateToStepOrder: body.escalateToStepOrder,
      escalationNotifyAdmin: body.escalationNotifyAdmin,
      allowDelegation: body.allowDelegation,
    })
    .returning()

  return { data: inserted }
})
