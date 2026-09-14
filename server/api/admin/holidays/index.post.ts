import { requirePermission } from '~~/server/utils/guard'
import { holidayInputSchema } from '~~/server/validators/admin'
import { createHoliday } from '~~/server/services/setting.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.setting.manage')
  const body = await readValidatedBody(event, holidayInputSchema.parse)
  return { data: await createHoliday(body, auth) }
})
