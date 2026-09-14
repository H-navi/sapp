import { requirePermission } from '~~/server/utils/guard'
import { getPolicyById } from '~~/server/services/policy.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.policy.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID kebijakan wajib diisi' })
  }
  return { data: await getPolicyById(id) }
})
