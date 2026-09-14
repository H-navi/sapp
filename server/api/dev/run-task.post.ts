import reminderTask from '../../tasks/approval/reminder'
import escalationTask from '../../tasks/approval/escalation'
import autoDecisionTask from '../../tasks/approval/auto-decision'
import dailyTask from '../../tasks/maintenance/daily'

export default defineEventHandler(async (event) => {
  // Wajib kembalikan 404 di lingkungan produksi
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = await readBody(event)
  const taskName = body?.task as string

  const taskMap: Record<string, any> = {
    'approval:reminder': reminderTask,
    'approval:escalation': escalationTask,
    'approval:auto-decision': autoDecisionTask,
    'maintenance:daily': dailyTask,
  }

  const task = taskMap[taskName]
  if (!task) {
    throw createError({
      statusCode: 400,
      statusMessage: `Tugas '${taskName}' tidak dikenali. Pilihan: ${Object.keys(taskMap).join(', ')}`,
    })
  }

  const result = await task.run({ payload: body?.payload ?? {} })
  return {
    success: true,
    task: taskName,
    result,
  }
})
