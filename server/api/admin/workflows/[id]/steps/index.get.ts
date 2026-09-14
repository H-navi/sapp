import { asc, eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const workflowId = getRouterParam(event, 'id')
  if (!workflowId) {
    throw createError({ statusCode: 400, message: 'ID alur persetujuan wajib diisi' })
  }

  const db = useDatabase()
  const steps = await db
    .select()
    .from(schema.approvalWorkflowSteps)
    .where(eq(schema.approvalWorkflowSteps.workflowId, workflowId))
    .orderBy(asc(schema.approvalWorkflowSteps.stepOrder))

  return { data: steps }
})
