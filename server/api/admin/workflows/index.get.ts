import { requirePermission } from '~~/server/utils/guard'
import { listAdminWorkflows } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.workflow.manage')
  const items = await listAdminWorkflows()
  return { data: items }
})
