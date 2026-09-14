import { requirePermission } from '~~/server/utils/guard'
import { listSystemSettings, updateSystemSetting } from '~~/server/services/setting.service'
import { systemSettingInputSchema } from '~~/server/validators/admin'

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    requirePermission(event, 'admin.setting.manage')
    return { data: await listSystemSettings() }
  }

  if (event.method === 'PUT') {
    const auth = requirePermission(event, 'admin.setting.manage')
    const body = await readValidatedBody(event, systemSettingInputSchema.parse)
    return { data: await updateSystemSetting(body.key, body.value, auth) }
  }
})
