import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, and, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../server/database'
import { createRequest } from '../../server/services/leave-request.service'
import reminderTask from '../../server/tasks/approval/reminder'
import { getFixtures, makeAuth, cleanupRequest } from './helpers'

describe('Integration: Approval Reminder Scheduler (Task 13)', () => {
  const activeRequestIds: string[] = []

  beforeEach(async () => {
    const { budi } = await getFixtures()
    const db = useDatabase()
    await db.execute(sql`
      DELETE FROM leave_requests WHERE employee_id = ${budi.id}::uuid
    `)
  })

  afterEach(async () => {
    while (activeRequestIds.length > 0) {
      const id = activeRequestIds.pop()
      await cleanupRequest(id)
    }
  })

  it('1. Di luar jam kerja -> tidak mengirim, reminder_count tetap, next_reminder ditunda', async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-09-23',
        endDate: '2026-09-24',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Uji reminder di luar jam kerja',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req.id)

    const [step1Task] = await db
      .select()
      .from(schema.approvalTasks)
      .where(and(eq(schema.approvalTasks.requestId, req.id), eq(schema.approvalTasks.stepOrder, 1)))
      .limit(1)

    // Simulasikan jadwal reminder telah tiba (next_reminder_at = 1 jam lalu)
    await db.execute(sql`
      UPDATE approval_tasks
      SET next_reminder_at = NOW() - INTERVAL '1 hour'
      WHERE id = ${step1Task.id}::uuid
    `)

    // Hari Minggu pukul 20:00 WIB (di luar jam kerja)
    const sundayNight = new Date('2026-09-27T20:00:00+07:00')

    // Hitung jumlah notifikasi awal sebelum reminder run
    const beforeNotifs = (
      await db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.taskId, step1Task.id),
            eq(schema.notifications.eventType, 'APPROVAL_REMINDER')
          )
        )
    ).length

    // Jalankan scheduler reminder dengan waktu di luar jam kerja
    await (reminderTask as any).run(sundayNight)

    // Verifikasi task:
    const [taskAfter] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step1Task.id))
      .limit(1)

    // 1. reminder_count TETAP 0 (tidak dinaikkan!)
    expect(Number(taskAfter.reminderCount)).toBe(0)

    // 2. nextReminderAt ditunda ke hari kerja berikutnya
    expect(taskAfter.nextReminderAt).toBeDefined()
    expect(new Date(taskAfter.nextReminderAt!).getTime()).toBeGreaterThan(sundayNight.getTime())

    // 3. Tidak ada notifikasi APPROVAL_REMINDER baru yang dikirim
    const afterNotifs = (
      await db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.taskId, step1Task.id),
            eq(schema.notifications.eventType, 'APPROVAL_REMINDER')
          )
        )
    ).length

    expect(afterNotifs).toBe(beforeNotifs)
  })

  it('2. Dijalankan dua kali beruntun -> tidak ada notifikasi ganda (dedupe)', async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-09-29',
        endDate: '2026-09-30',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Uji deduplikasi notifikasi reminder',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req.id)

    const [step1Task] = await db
      .select()
      .from(schema.approvalTasks)
      .where(and(eq(schema.approvalTasks.requestId, req.id), eq(schema.approvalTasks.stepOrder, 1)))
      .limit(1)

    // Atur next_reminder_at ke masa lalu
    await db.execute(sql`
      UPDATE approval_tasks
      SET next_reminder_at = NOW() - INTERVAL '1 hour'
      WHERE id = ${step1Task.id}::uuid
    `)

    // Waktu pada hari kerja: Selasa 10:00 WIB (jam kerja aktif)
    const tuesdayMorning = new Date('2026-11-17T10:00:00+07:00')

    // Jalankan pertama kali
    await (reminderTask as any).run(tuesdayMorning)

    const notifsAfterFirst = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.taskId, step1Task.id),
          eq(schema.notifications.eventType, 'APPROVAL_REMINDER')
        )
      )

    expect(notifsAfterFirst.length).toBeGreaterThanOrEqual(1)
    const countFirst = notifsAfterFirst.length

    // Jika scheduler dijalankan kedua kali beruntun dengan dedupe_key yang sama:
    // Paksa trigger ulang dengan next_reminder_at di masa lalu pada reminder_count yang sama
    await db.execute(sql`
      UPDATE approval_tasks
      SET next_reminder_at = NOW() - INTERVAL '1 minute',
          reminder_count = 0
      WHERE id = ${step1Task.id}::uuid
    `)

    await (reminderTask as any).run(tuesdayMorning)

    // Verifikasi jumlah notifikasi tidak menduplikasi record yang sudah ada
    // karena dedupe_key: reminder:${task.id}:${employee.id}:1 sudah ada
    const notifsAfterSecond = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.taskId, step1Task.id),
          eq(schema.notifications.eventType, 'APPROVAL_REMINDER')
        )
      )

    // Jumlah notifikasi untuk key pengingat ke-1 tetap sama persis (tidak dobel)
    expect(notifsAfterSecond.length).toBe(countFirst)
  })
})
