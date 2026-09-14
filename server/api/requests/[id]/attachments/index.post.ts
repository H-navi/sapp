import { requirePermission } from '~~/server/utils/guard'
import { uploadAttachment } from '~~/server/services/leave-request.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'request.create')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pengajuan wajib diisi.' })
  }

  const files = await readMultipartFormData(event)
  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, message: 'Tidak ada berkas yang diunggah.' })
  }

  const file = files.find((f) => f.name === 'file') || files[0]
  if (!file) {
    throw createError({ statusCode: 400, message: 'Berkas tidak ditemukan dalam formulir unggah.' })
  }

  return { data: await uploadAttachment(id, file, auth) }
})
