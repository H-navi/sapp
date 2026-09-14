import { requirePermission } from '~~/server/utils/guard'
import { employeeInputSchema } from '~~/server/validators/employee'
import { updateEmployee } from '~~/server/services/employee.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pegawai wajib diisi' })
  }
  const body = await readValidatedBody(event, employeeInputSchema.partial().parse)
  return { data: await updateEmployee(id, body, auth) }
})
