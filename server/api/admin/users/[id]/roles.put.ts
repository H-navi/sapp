import { z } from 'zod'
import { requirePermission } from '~~/server/utils/guard'
import { assignRoles } from '~~/server/services/employee.service'

const rolesSchema = z.object({
  roles: z.array(z.string().min(1)),
})

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.role.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pengguna wajib diisi' })
  }
  const body = await readValidatedBody(event, rolesSchema.parse)
  return { data: await assignRoles(id, body.roles, auth) }
})
