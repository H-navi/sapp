import { requirePermission } from '~~/server/utils/guard'
import { resetPassword } from '~~/server/services/employee.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pegawai wajib diisi' })
  }
  return { data: await resetPassword(id, auth) }
})
