import { requirePermission } from '~~/server/utils/guard'
import { eligibilityListSchema } from '~~/server/validators/admin'
import { saveLeaveTypeEligibilities } from '~~/server/services/eligibility.service'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.leavetype.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID jenis izin wajib diisi' })
  }
  const body = await readValidatedBody(event, eligibilityListSchema.parse)
  return { data: await saveLeaveTypeEligibilities(id, body.rules, auth) }
})
