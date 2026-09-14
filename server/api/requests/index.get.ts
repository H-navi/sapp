import { requirePermission } from '~~/server/utils/guard'
import { listMyRequests } from '~~/server/services/leave-request.service'
import { leaveRequestQuerySchema } from '~~/server/validators/request'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'request.view.own')
  if (!auth.employeeId) {
    throw createError({ statusCode: 400, message: 'User tidak tertaut dengan data pegawai.' })
  }
  const query = await getValidatedQuery(event, leaveRequestQuerySchema.parse)
  return { data: await listMyRequests(auth.employeeId, query) }
})
