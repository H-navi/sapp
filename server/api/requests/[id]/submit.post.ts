import { requirePermission } from '~~/server/utils/guard'
import { submitRequest } from '~~/server/services/leave-request.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'request.create')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pengajuan wajib diisi.' })
  }
  return { data: await submitRequest(id, auth) }
})
