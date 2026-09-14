import { requirePermission } from '~~/server/utils/guard'
import { listHolidays } from '~~/server/services/setting.service'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admin.setting.manage')
  return { data: await listHolidays() }
})
