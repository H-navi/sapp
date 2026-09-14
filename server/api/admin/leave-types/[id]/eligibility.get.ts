import { requirePermission } from '~~/server/utils/guard'
import { getLeaveTypeEligibilities } from '~~/server/services/eligibility.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.leavetype.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID jenis izin wajib diisi' })
  }
  return { data: await getLeaveTypeEligibilities(id) }
})
