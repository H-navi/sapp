import { requirePermission } from '~~/server/utils/guard'
import { getDelegations } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'approval.delegate', 'approval.act')
  if (!auth.employeeId) {
    return { data: [] }
  }

  const items = await getDelegations(auth.employeeId)
  return { data: items }
})
