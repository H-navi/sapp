import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { workflowInputSchema } from '~~/server/validators/admin'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID alur persetujuan wajib diisi' })
  }

  const body = await readValidatedBody(event, workflowInputSchema.partial().parse)
  const db = useDatabase()

  const payload: Partial<typeof schema.approvalWorkflows.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (body.code !== undefined) payload.code = body.code
  if (body.name !== undefined) payload.name = body.name
  if (body.description !== undefined) payload.description = body.description
  if (body.leaveTypeId !== undefined) payload.leaveTypeId = body.leaveTypeId
  if (body.departmentId !== undefined) payload.departmentId = body.departmentId
  if (body.positionLevelMin !== undefined) payload.positionLevelMin = body.positionLevelMin
  if (body.positionLevelMax !== undefined) payload.positionLevelMax = body.positionLevelMax
  if (body.employmentStatus !== undefined) payload.employmentStatus = body.employmentStatus as any
  if (body.minDays !== undefined) payload.minDays = body.minDays ? String(body.minDays) : null
  if (body.maxDays !== undefined) payload.maxDays = body.maxDays ? String(body.maxDays) : null
  if (body.priority !== undefined) payload.priority = body.priority
  if (body.effectiveFrom !== undefined) payload.effectiveFrom = body.effectiveFrom
  if (body.effectiveTo !== undefined) payload.effectiveTo = body.effectiveTo
  if (body.isActive !== undefined) payload.isActive = body.isActive

  const [updated] = await db
    .update(schema.approvalWorkflows)
    .set(payload)
    .where(eq(schema.approvalWorkflows.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Alur persetujuan tidak ditemukan' })
  }

  return { data: updated }
})
