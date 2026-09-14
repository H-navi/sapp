import { requirePermission } from '~~/server/utils/guard'
import { getPolicyByLeaveType } from '~~/server/services/policy.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.policy.manage')
  const leaveTypeId = getRouterParam(event, 'id')
  if (!leaveTypeId) {
    throw createError({ statusCode: 400, message: 'ID jenis izin wajib diisi' })
  }
  const result = await getPolicyByLeaveType(leaveTypeId)
  return { data: result }
})
