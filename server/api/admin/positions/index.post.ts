import { requirePermission } from '~~/server/utils/guard'
import { positionInputSchema } from '~~/server/validators/admin'
import { createPosition } from '~~/server/services/organization.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const body = await readValidatedBody(event, positionInputSchema.parse)
  return { data: await createPosition(body, auth) }
})
