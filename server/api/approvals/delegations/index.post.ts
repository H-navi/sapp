import { requirePermission } from '~~/server/utils/guard'
import { delegationInputSchema } from '~~/server/validators/approval'
import { createDelegation } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'approval.delegate', 'approval.act')
  if (!auth.employeeId) {
    throw createError({
      statusCode: 403,
      message: 'Akun Anda tidak terhubung dengan data pegawai untuk mendelegasikan wewenang.',
    })
  }

  const body = await readValidatedBody(event, delegationInputSchema.parse)
  const result = await createDelegation(auth.employeeId, body, auth.userId)
  return { data: result }
})
