import { requirePermission } from '~~/server/utils/guard'
import { cancelRequest } from '~~/server/services/leave-request.service'
import { cancelRequestSchema } from '~~/server/validators/request'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'request.cancel.own')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pengajuan wajib diisi.' })
  }
  const body = await readValidatedBody(event, cancelRequestSchema.parse)
  return { data: await cancelRequest(id, body.reason, auth) }
})
