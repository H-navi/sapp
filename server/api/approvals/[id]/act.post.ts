import { requirePermission } from '~~/server/utils/guard'
import { actOnTaskSchema } from '~~/server/validators/approval'
import { actOnTask } from '~~/server/services/approval'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'approval.act')
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'ID tugas persetujuan wajib diisi' })
  }

  if (!auth.employeeId) {
    throw createError({
      statusCode: 403,
      message: 'Akun Anda tidak terhubung dengan data pegawai untuk melakukan persetujuan.',
    })
  }

  const body = await readValidatedBody(event, actOnTaskSchema.parse)
  const result = await actOnTask({
    taskId,
    actorEmployeeId: auth.employeeId,
    action: body.action,
    note: body.note,
  })

  return { data: result }
})
