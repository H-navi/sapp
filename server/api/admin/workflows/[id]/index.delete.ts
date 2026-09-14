import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/guard'
import { useDatabase } from '~~/server/database'
import * as schema from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID alur persetujuan wajib diisi' })
  }

  const db = useDatabase()
  const [deleted] = await db
    .delete(schema.approvalWorkflows)
    .where(eq(schema.approvalWorkflows.id, id))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Alur persetujuan tidak ditemukan' })
  }

  return { success: true, id: deleted.id }
})
