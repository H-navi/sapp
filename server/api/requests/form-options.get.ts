import { requirePermission } from '~~/server/utils/guard'
import { getFormOptions } from '~~/server/services/leave-request.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'request.create')
  if (!auth.employeeId) {
    throw createError({ statusCode: 400, message: 'User tidak tertaut dengan data pegawai.' })
  }
  return { data: await getFormOptions(auth.employeeId) }
})
