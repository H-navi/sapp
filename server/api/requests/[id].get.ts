import { requireAuth } from '~~/server/utils/guard'
import { getRequestDetail } from '~~/server/services/leave-request.service'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pengajuan wajib diisi.' })
  }
  return { data: await getRequestDetail(id, auth) }
})
