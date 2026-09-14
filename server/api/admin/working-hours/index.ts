import { requirePermission } from '~~/server/utils/guard'
import { listWorkingHours, updateWorkingHour } from '~~/server/services/setting.service'
import { workingHourInputSchema } from '~~/server/validators/admin'

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    requirePermission(event, 'admin.setting.manage')
    return { data: await listWorkingHours() }
  }

  if (event.method === 'PUT') {
    const auth = requirePermission(event, 'admin.setting.manage')
    const body = await readValidatedBody(event, workingHourInputSchema.parse)
    return { data: await updateWorkingHour(body.dayOfWeek, body, auth) }
  }
})
