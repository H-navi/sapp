import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { workflowStepPatchSchema } from '~~/server/validators/admin'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const stepId = getRouterParam(event, 'id')
  if (!stepId) {
    throw createError({ statusCode: 400, message: 'ID tahap persetujuan wajib diisi' })
  }

  const body = await readValidatedBody(event, workflowStepPatchSchema.parse)
  const db = useDatabase()

  const payload: Partial<typeof schema.approvalWorkflowSteps.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (body.stepOrder !== undefined) payload.stepOrder = body.stepOrder
  if (body.name !== undefined) payload.name = body.name
  if (body.approverType !== undefined) payload.approverType = body.approverType as any
  if (body.approverPositionId !== undefined) payload.approverPositionId = body.approverPositionId
  if (body.approverPositionLevel !== undefined) payload.approverPositionLevel = body.approverPositionLevel
  if (body.approverEmployeeId !== undefined) payload.approverEmployeeId = body.approverEmployeeId
  if (body.approverRoleId !== undefined) payload.approverRoleId = body.approverRoleId
  if (body.approvalMode !== undefined) payload.approvalMode = body.approvalMode as any
  if (body.quorumCount !== undefined) payload.quorumCount = body.quorumCount
  if (body.isOptional !== undefined) payload.isOptional = body.isOptional
  if (body.skipIfRequester !== undefined) payload.skipIfRequester = body.skipIfRequester
  if (body.skipIfAlreadyApproved !== undefined) payload.skipIfAlreadyApproved = body.skipIfAlreadyApproved
  if (body.conditionMinDays !== undefined) payload.conditionMinDays = body.conditionMinDays ? String(body.conditionMinDays) : null
  if (body.slaHours !== undefined) payload.slaHours = String(body.slaHours)
  if (body.slaUsesWorkingHours !== undefined) payload.slaUsesWorkingHours = body.slaUsesWorkingHours
  if (body.reminderEnabled !== undefined) payload.reminderEnabled = body.reminderEnabled
  if (body.reminderIntervalMinutes !== undefined) payload.reminderIntervalMinutes = body.reminderIntervalMinutes
  if (body.reminderMaxCount !== undefined) payload.reminderMaxCount = body.reminderMaxCount
  if (body.escalationAction !== undefined) payload.escalationAction = body.escalationAction as any
  if (body.escalateToStepOrder !== undefined) payload.escalateToStepOrder = body.escalateToStepOrder
  if (body.escalationNotifyAdmin !== undefined) payload.escalationNotifyAdmin = body.escalationNotifyAdmin
  if (body.allowDelegation !== undefined) payload.allowDelegation = body.allowDelegation

  const [updated] = await db
    .update(schema.approvalWorkflowSteps)
    .set(payload)
    .where(eq(schema.approvalWorkflowSteps.id, stepId))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Tahap persetujuan tidak ditemukan' })
  }

  return { data: updated }
})
