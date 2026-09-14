import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const stepId = getRouterParam(event, 'id')
  if (!stepId) {
    throw createError({ statusCode: 400, message: 'ID tahap persetujuan wajib diisi' })
  }

  const db = useDatabase()
  const [deleted] = await db
    .delete(schema.approvalWorkflowSteps)
    .where(eq(schema.approvalWorkflowSteps.id, stepId))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Tahap persetujuan tidak ditemukan' })
  }

  return { success: true, id: deleted.id }
})
