import { requirePermission } from '~~/server/utils/guard'
import { policyTestDryRunSchema } from '~~/server/validators/admin'
import { dryRunPolicyTest } from '~~/server/services/policy.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.policy.manage')
  const policyId = getRouterParam(event, 'id')
  if (!policyId) {
    throw createError({ statusCode: 400, message: 'ID kebijakan wajib diisi' })
  }

  const body = await readValidatedBody(event, policyTestDryRunSchema.parse)
  const result = await dryRunPolicyTest(policyId, body)
  return { data: result }
})
