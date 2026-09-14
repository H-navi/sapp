import { requirePermission } from '~~/server/utils/guard'
import { positionInputSchema } from '~~/server/validators/admin'
import { updatePosition } from '~~/server/services/organization.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID jabatan wajib diisi' })
  }
  const body = await readValidatedBody(event, positionInputSchema.partial().parse)
  return { data: await updatePosition(id, body, auth) }
})
