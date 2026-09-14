import { requirePermission } from '~~/server/utils/guard'
import { getAdminWorkflowById } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID alur persetujuan wajib diisi' })
  }

  const result = await getAdminWorkflowById(id)
  return { data: result }
})
