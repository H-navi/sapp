import { requirePermission } from '~~/server/utils/guard'
import { deleteAttachment } from '~~/server/services/leave-request.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'request.create')
  const id = getRouterParam(event, 'id')
  const attId = getRouterParam(event, 'attId')
  if (!id || !attId) {
    throw createError({ statusCode: 400, message: 'ID pengajuan dan lampiran wajib diisi.' })
  }

  return { data: await deleteAttachment(id, attId, auth) }
})
