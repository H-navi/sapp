import { requirePermission } from '~~/server/utils/guard'
import { deletePolicyRule } from '~~/server/services/policy.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.policy.manage')
  const ruleId = getRouterParam(event, 'id')
  if (!ruleId) {
    throw createError({ statusCode: 400, message: 'ID aturan wajib diisi' })
  }

  const result = await deletePolicyRule(ruleId, auth)
  return { data: result }
})
