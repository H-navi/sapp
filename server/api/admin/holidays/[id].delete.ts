import { requirePermission } from '~~/server/utils/guard'
import { deleteHoliday } from '~~/server/services/setting.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.setting.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID hari libur wajib diisi' })
  }
  return { data: await deleteHoliday(id, auth) }
})
