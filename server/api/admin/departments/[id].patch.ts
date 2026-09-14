import { requirePermission } from '~~/server/utils/guard'
import { departmentInputSchema } from '~~/server/validators/admin'
import { updateDepartment } from '~~/server/services/organization.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID departemen wajib diisi' })
  }
  const body = await readValidatedBody(event, departmentInputSchema.partial().parse)
  return { data: await updateDepartment(id, body, auth) }
})
