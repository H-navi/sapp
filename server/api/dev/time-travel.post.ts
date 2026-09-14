import { eq, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { useDatabase } from '../../database'
import * as schema from '../../database/schema'

export default defineEventHandler(async (event) => {
  // Wajib kembalikan 404 di lingkungan produksi
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const db = useDatabase()
  const body = await readBody(event)
  const { requestId, taskId, advanceMinutes, setPast = true } = body || {}

  const minutes = Number(advanceMinutes ?? 60)
  const targetTime = setPast
    ? dayjs().subtract(minutes, 'minute').toDate()
    : dayjs().add(minutes, 'minute').toDate()

  const modified: Record<string, any> = {}

  if (taskId) {
    await db
      .update(schema.approvalTasks)
      .set({
        dueAt: targetTime,
        nextReminderAt: targetTime,
        updatedAt: new Date(),
      })
      .where(eq(schema.approvalTasks.id, taskId))

    modified.taskId = taskId
    modified.newDueAt = targetTime
  }

  if (requestId) {
    await db
      .update(schema.leaveRequests)
      .set({
        finalDeadlineAt: targetTime,
        updatedAt: new Date(),
      })
      .where(eq(schema.leaveRequests.id, requestId))

    // Juga perbarui task PENDING di pengajuan ini bila ada
    await db
      .update(schema.approvalTasks)
      .set({
        dueAt: targetTime,
        nextReminderAt: targetTime,
        updatedAt: new Date(),
      })
      .where(sql`request_id = ${requestId}::uuid AND status = 'PENDING'`)

    modified.requestId = requestId
    modified.newFinalDeadlineAt = targetTime
  }

  if (!taskId && !requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Harus menyertakan setidaknya requestId atau taskId',
    })
  }

  return {
    success: true,
    message: `Waktu berhasil dimanipulasi (${setPast ? 'dimundurkan ke masa lalu' : 'dimajukan'}).`,
    targetTime,
    modified,
  }
})
