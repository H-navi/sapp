import { requirePermission } from '~~/server/utils/guard'
import { inboxQuerySchema } from '~~/server/validators/approval'
import { getApproverInbox } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'approval.view', 'approval.act')
  if (!auth.employeeId) {
    return { data: [] }
  }

  const query = await getValidatedQuery(event, inboxQuerySchema.parse)
  const items = await getApproverInbox(auth.employeeId, query.filter)
  return { data: items }
})
