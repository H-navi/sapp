import { requirePermission } from '~~/server/utils/guard'
import { policyNewVersionSchema } from '~~/server/validators/admin'
import { createPolicyNewVersion } from '~~/server/services/policy.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.policy.manage')
  const policyId = getRouterParam(event, 'id')
  if (!policyId) {
    throw createError({ statusCode: 400, message: 'ID kebijakan wajib diisi' })
  }

  const body = await readValidatedBody(event, policyNewVersionSchema.parse)
  const result = await createPolicyNewVersion(policyId, body, auth)
  return { data: result }
})
