import { requirePermission } from '~~/server/utils/guard'
import { departmentInputSchema } from '~~/server/validators/admin'
import { createDepartment } from '~~/server/services/organization.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const body = await readValidatedBody(event, departmentInputSchema.parse)
  return { data: await createDepartment(body, auth) }
})
