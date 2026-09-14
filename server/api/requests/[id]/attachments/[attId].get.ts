import { requireAuth } from '~~/server/utils/guard'
import { getAttachmentStream } from '~~/server/services/leave-request.service'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = getRouterParam(event, 'id')
  const attId = getRouterParam(event, 'attId')
  if (!id || !attId) {
    throw createError({ statusCode: 400, message: 'ID pengajuan dan lampiran wajib diisi.' })
  }

  const { stream, fileName, mimeType, size } = await getAttachmentStream(id, attId, auth)

  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`)
  if (size) {
    setHeader(event, 'Content-Length', size)
  }

  return sendStream(event, stream)
})
