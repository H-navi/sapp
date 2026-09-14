import { requirePermission } from '~~/server/utils/guard'
import { workflowInputSchema } from '~~/server/validators/admin'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.workflow.manage')
  const body = await readValidatedBody(event, workflowInputSchema.parse)

  const db = useDatabase()
  const [inserted] = await db
    .insert(schema.approvalWorkflows)
    .values({
      code: body.code,
      name: body.name,
      description: body.description,
      leaveTypeId: body.leaveTypeId,
      departmentId: body.departmentId,
      positionLevelMin: body.positionLevelMin,
      positionLevelMax: body.positionLevelMax,
      employmentStatus: body.employmentStatus as any,
      minDays: body.minDays ? String(body.minDays) : null,
      maxDays: body.maxDays ? String(body.maxDays) : null,
      priority: body.priority,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      isActive: body.isActive,
      createdBy: auth.userId ? (auth.userId as any) : null,
    })
    .returning()

  return { data: inserted }
})
