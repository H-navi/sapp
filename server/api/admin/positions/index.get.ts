import { requirePermission } from '~~/server/utils/guard'
import { listPositions } from '~~/server/services/organization.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.employee.manage')
  return { data: await listPositions() }
})
