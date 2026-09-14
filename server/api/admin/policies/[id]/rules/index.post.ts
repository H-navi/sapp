import { requirePermission } from '~~/server/utils/guard'
import { ruleCreateSchema } from '~~/server/validators/admin'
import { addPolicyRule } from '~~/server/services/policy.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.policy.manage')
  const policyId = getRouterParam(event, 'id')
  if (!policyId) {
    throw createError({ statusCode: 400, message: 'ID kebijakan wajib diisi' })
  }

  const body = await readValidatedBody(event, ruleCreateSchema.parse)
  const rule = await addPolicyRule(policyId, body, auth)
  return { data: rule }
})
