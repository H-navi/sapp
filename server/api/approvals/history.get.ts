import { requirePermission } from '~~/server/utils/guard'
import { getApprovalHistory } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'approval.view', 'approval.act')
  if (!auth.employeeId) {
    return { data: [] }
  }

  const items = await getApprovalHistory(auth.employeeId)
  return { data: items }
})
