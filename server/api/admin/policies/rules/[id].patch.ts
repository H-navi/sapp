import { requirePermission } from '~~/server/utils/guard'
import { ruleUpdateSchema } from '~~/server/validators/admin'
import { updatePolicyRule } from '~~/server/services/policy.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.policy.manage')
  const ruleId = getRouterParam(event, 'id')
  if (!ruleId) {
    throw createError({ statusCode: 400, message: 'ID aturan wajib diisi' })
  }

  const body = await readValidatedBody(event, ruleUpdateSchema.parse)
  const result = await updatePolicyRule(ruleId, body, auth)
  return { data: result }
})
