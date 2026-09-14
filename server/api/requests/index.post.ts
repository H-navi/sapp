import { requirePermission } from '~~/server/utils/guard'
import { createRequest } from '~~/server/services/leave-request.service'
import { leaveRequestInputSchema } from '~~/server/validators/request'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'request.create')
  const body = await readValidatedBody(event, leaveRequestInputSchema.parse)
  return { data: await createRequest(body, auth) }
})
