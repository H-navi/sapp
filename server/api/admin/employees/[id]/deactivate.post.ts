import { z } from 'zod'
import { requirePermission } from '~~/server/utils/guard'
import { deactivateEmployee } from '~~/server/services/employee.service'

const deactivateSchema = z.object({
  endDate: z.string().min(10).max(10),
})

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admin.employee.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pegawai wajib diisi' })
  }
  const body = await readValidatedBody(event, deactivateSchema.parse)
  return { data: await deactivateEmployee(id, body.endDate, auth) }
})
