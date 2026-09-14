import { requirePermission } from '~~/server/utils/guard'
import { listLeaveTypes } from '~~/server/services/setting.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.leavetype.manage')
  return { data: await listLeaveTypes() }
})
