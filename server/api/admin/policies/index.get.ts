import { requirePermission } from '~~/server/utils/guard'
import { listPolicies } from '~~/server/services/policy.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.policy.manage')
  return { data: await listPolicies() }
})
