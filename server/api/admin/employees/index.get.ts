import { requirePermission } from '~~/server/utils/guard'
import { employeeQuerySchema, employeeInputSchema } from '~~/server/validators/employee'
import { listEmployees, createEmployee } from '~~/server/services/employee.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const query = await getValidatedQuery(event, employeeQuerySchema.parse)
  return { data: await listEmployees(query) }
})
