import { requirePermission } from '~~/server/utils/guard'
import { leaveTypePatchSchema } from '~~/server/validators/admin'
import { updateLeaveType } from '~~/server/services/setting.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.leavetype.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID jenis izin wajib diisi' })
  }
  const body = await readValidatedBody(event, leaveTypePatchSchema.parse)
  return { data: await updateLeaveType(id, body, auth) }
})
