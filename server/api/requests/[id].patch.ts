import { requirePermission } from '~~/server/utils/guard'
import { useDatabase, schema } from '~~/server/database'
import { eq } from 'drizzle-orm'
import { expandLeaveDays, summarizeDays } from '~~/server/utils/calendar'
import { leaveRequestPatchSchema } from '~~/server/validators/request'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'request.create')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID pengajuan wajib diisi.' })
  }

  const body = await readValidatedBody(event, leaveRequestPatchSchema.parse)
  const db = useDatabase()

  const [existing] = await db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, id))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Pengajuan tidak ditemukan.' })
  }

  if (existing.status !== 'DRAFT') {
    throw createError({ statusCode: 400, message: 'Hanya draf yang dapat diperbarui.' })
  }

  if (existing.employeeId !== auth.employeeId && !auth.roles.includes('ADMIN')) {
    throw createError({ statusCode: 403, message: 'Akses ditolak.' })
  }

  const leaveTypeId = body.leaveTypeId || existing.leaveTypeId
  const startDate = body.startDate || existing.startDate
  const endDate = body.endDate || existing.endDate
  const startDayPart = body.startDayPart || existing.startDayPart
  const endDayPart = body.endDayPart || existing.endDayPart

  const [lt] = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, leaveTypeId))
    .limit(1)

  const days = await expandLeaveDays(db, startDate, endDate, startDayPart, endDayPart)
  const summary = summarizeDays(days, lt?.countsWorkingDaysOnly ?? true)

  // Update request days
  await db.delete(schema.leaveRequestDays).where(eq(schema.leaveRequestDays.requestId, id))
  for (const d of days) {
    await db.insert(schema.leaveRequestDays).values({
      requestId: id,
      leaveDate: d.date,
      dayPart: d.dayPart,
      dayValue: String(d.dayValue),
      isWorkingDay: d.isWorkingDay,
      isHoliday: d.isHoliday,
    })
  }

  const [updated] = await db
    .update(schema.leaveRequests)
    .set({
      leaveTypeId,
      startDate,
      endDate,
      startDayPart,
      endDayPart,
      totalDays: String(summary.totalDays),
      workingDays: String(summary.workingDays),
      reason: body.reason ?? existing.reason,
      addressDuringLeave: body.addressDuringLeave !== undefined ? body.addressDuringLeave : existing.addressDuringLeave,
      contactPhone: body.contactPhone !== undefined ? body.contactPhone : existing.contactPhone,
      delegateEmployeeId: body.delegateEmployeeId !== undefined ? body.delegateEmployeeId : existing.delegateEmployeeId,
      updatedAt: new Date(),
    })
    .where(eq(schema.leaveRequests.id, id))
    .returning()

  return { data: updated }
})
