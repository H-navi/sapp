import { requirePermission } from '~~/server/utils/guard'
import { employeeInputSchema } from '~~/server/validators/employee'
import { createEmployee } from '~~/server/services/employee.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const body = await readValidatedBody(event, employeeInputSchema.parse)
  return { data: await createEmployee(body, auth) }
})
