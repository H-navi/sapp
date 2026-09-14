import { requirePermission } from '~~/server/utils/guard'
import { getApprovalDetail } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'approval.view', 'approval.act')
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'ID tugas persetujuan wajib diisi' })
  }

  const result = await getApprovalDetail(taskId, auth.employeeId ?? undefined)
  return { data: result }
})
