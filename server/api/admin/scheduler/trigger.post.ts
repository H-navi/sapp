import { requireRole } from '~~/server/utils/guard'
import reminderTask from '~~/server/tasks/approval/reminder'
import escalationTask from '~~/server/tasks/approval/escalation'
import autoDecisionTask from '~~/server/tasks/approval/auto-decision'
import dailyTask from '~~/server/tasks/maintenance/daily'

export default defineEventHandler(async (event) => {
  requireRole(event, 'ADMIN', 'SUPERADMIN')
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
      statusMessage: `Tugas '${taskName}' tidak valid. Pilihan: ${Object.keys(taskMap).join(', ')}`,
    })
  }

  const result = await task.run({ payload: {} })
  return {
    success: true,
    task: taskName,
    result,
  }
})
