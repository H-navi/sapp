import { requirePermission } from '~~/server/utils/guard'
import { deleteDelegation } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'approval.delegate', 'approval.act')
  const delegationId = getRouterParam(event, 'id')
  if (!delegationId) {
    throw createError({ statusCode: 400, message: 'ID delegasi wajib diisi' })
  }

  if (!auth.employeeId) {
    throw createError({ statusCode: 403, message: 'Akses ditolak' })
  }

  const result = await deleteDelegation(delegationId, auth.employeeId)
  return { data: result }
})
