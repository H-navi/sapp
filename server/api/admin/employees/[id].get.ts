import { requirePermission } from '~~/server/utils/guard'
import { getEmployee } from '~~/server/services/employee.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.employee.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pegawai wajib diisi' })
  }
  return { data: await getEmployee(id) }
})
