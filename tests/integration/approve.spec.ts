import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, and, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../server/database'
import { createRequest } from '../../server/services/leave-request.service'
import { actOnTask } from '../../server/services/approval/engine'
import { getFixtures, makeAuth, cleanupRequest } from './helpers'

describe('Integration: Approval Flow Scenarios (Task 13)', () => {
  const activeRequestIds: string[] = []

  beforeEach(async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    await db.execute(sql`
      DELETE FROM leave_requests WHERE employee_id = ${budi.id}::uuid
    `)
    await db.execute(sql`
      UPDATE leave_quotas
      SET allocated = 12, reserved = 0, used = 0, carried_over = 0, adjustment = 0, updated_at = NOW()
      WHERE employee_id = ${budi.id}::uuid
        AND leave_type_id = ${cutiTahunan.id}::uuid
        AND period_year = 2026::smallint
    `)
  })

  afterEach(async () => {
    while (activeRequestIds.length > 0) {
      const id = activeRequestIds.pop()
      await cleanupRequest(id)
    }
  })

  it('Setujui tahap 1 -> tahap 2 PENDING, assignee terisi, notifikasi terantre', async () => {
    const { budi, andi, rina, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // Budi mengajukan cuti 2 hari (alur WF_CUTI_PENDEK memiliki Step 1: Atasan, Step 2: Kepala Divisi)
    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-11-10',
        endDate: '2026-11-11',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Cuti tahunan 2 hari untuk pengujian approval',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req.id)

    // Ambil tugas step 1 dan step 2
    const tasks = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.requestId, req.id))

    const step1Task = tasks.find((t) => t.stepOrder === 1)!
    const step2Task = tasks.find((t) => t.stepOrder === 2)!

    expect(step1Task.status).toBe('PENDING')
    expect(step2Task.status).toBe('WAITING')

    // Verifikasi assignee tahap 1 adalah Andi (atasan Budi)
    const step1Assignees = await db
      .select()
      .from(schema.approvalTaskAssignees)
      .where(eq(schema.approvalTaskAssignees.taskId, step1Task.id))

    expect(step1Assignees.some((a) => a.employeeId === andi.id)).toBe(true)

    // Andi menyetujui tahap 1
    const actionResult = await actOnTask({
      taskId: step1Task.id,
      actorEmployeeId: andi.id,
      action: 'APPROVE',
      note: 'Disetujui atasan langsung',
    })

    expect(actionResult.success).toBe(true)
    expect(actionResult.stepCompleted).toBe(true)

    // Verifikasi tahap 1 sudah APPROVED
    const [updatedStep1] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step1Task.id))
      .limit(1)
    expect(updatedStep1.status).toBe('APPROVED')

    // Verifikasi tahap 2 sekarang menjadi PENDING
    const [updatedStep2] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step2Task.id))
      .limit(1)
    expect(updatedStep2.status).toBe('PENDING')

    // Verifikasi assignee tahap 2 sudah terisi (Rina - Kepala Divisi IT)
    const step2Assignees = await db
      .select()
      .from(schema.approvalTaskAssignees)
      .where(eq(schema.approvalTaskAssignees.taskId, step2Task.id))

    expect(step2Assignees.length).toBeGreaterThan(0)
    expect(step2Assignees.some((a) => a.employeeId === rina.id)).toBe(true)

    // Verifikasi notifikasi terantre di tabel notifications
    const queuedNotifs = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.requestId, req.id))

    expect(queuedNotifs.length).toBeGreaterThan(0)
  })

  it('Dua approver ANY_ONE bertindak bersamaan -> satu berhasil, satu 409 TASK_ALREADY_ACTED', async () => {
    const { budi, andi, rina, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-11-17',
        endDate: '2026-11-18',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Uji konkurensi approval ANY_ONE',
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

    // Tambahkan Rina sebagai approver kedua pada tugas ANY_ONE yang sama
    await db.insert(schema.approvalTaskAssignees).values({
      taskId: step1Task.id,
      employeeId: rina.id,
      isDelegate: false,
    })

    // Approver 1 (Andi) menyetujui tugas
    const res1 = await actOnTask({
      taskId: step1Task.id,
      actorEmployeeId: andi.id,
      action: 'APPROVE',
      note: 'Persetujuan pertama oleh Andi',
    })
    expect(res1.success).toBe(true)

    // Approver 2 (Rina) bertindak pada tugas yang sudah diputuskan
    let conflictError: any = null
    try {
      await actOnTask({
        taskId: step1Task.id,
        actorEmployeeId: rina.id,
        action: 'APPROVE',
        note: 'Persetujuan kedua oleh Rina yang datang terlambat',
      })
    } catch (err: any) {
      conflictError = err
    }

    expect(conflictError).toBeDefined()
    expect(conflictError.statusCode).toBe(409)
    expect(['APPROVAL_TASK_CLOSED', 'TASK_ALREADY_ACTED']).toContain(conflictError.statusMessage)
  })

  it('Mode QUORUM 2 dari 3 -> tahap selesai tepat pada persetujuan kedua', async () => {
    const { budi, andi, rina, joko, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-11-24',
        endDate: '2026-11-25',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Uji mode QUORUM 2 dari 3',
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

    // Konfigurasikan task step 1 ke mode QUORUM (2 persetujuan dari 3 approver)
    await db
      .update(schema.approvalTasks)
      .set({
        approvalMode: 'QUORUM',
        quorumCount: 2,
      })
      .where(eq(schema.approvalTasks.id, step1Task.id))

    // Pastikan ada 3 assignees: Andi, Rina, Joko
    // Hapus assignees lama lalu tambahkan ketiga kandidat
    await db.delete(schema.approvalTaskAssignees).where(eq(schema.approvalTaskAssignees.taskId, step1Task.id))
    await db.insert(schema.approvalTaskAssignees).values([
      { taskId: step1Task.id, employeeId: andi.id, isDelegate: false },
      { taskId: step1Task.id, employeeId: rina.id, isDelegate: false },
      { taskId: step1Task.id, employeeId: joko.id, isDelegate: false },
    ])

    // 1. Approver 1 (Andi) menyetujui
    const res1 = await actOnTask({
      taskId: step1Task.id,
      actorEmployeeId: andi.id,
      action: 'APPROVE',
      note: 'Setuju 1 dari 2',
    })

    expect(res1.success).toBe(true)
    expect(res1.stepCompleted).toBe(false) // Belum quorum!

    const [taskAfterFirst] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step1Task.id))
      .limit(1)
    expect(taskAfterFirst.status).toBe('PENDING')

    // 2. Approver 2 (Rina) menyetujui -> Quorum tercapai (2 dari 3)!
    const res2 = await actOnTask({
      taskId: step1Task.id,
      actorEmployeeId: rina.id,
      action: 'APPROVE',
      note: 'Setuju 2 dari 2',
    })

    expect(res2.success).toBe(true)
    expect(res2.stepCompleted).toBe(true) // Tahap selesai!

    const [taskAfterSecond] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step1Task.id))
      .limit(1)
    expect(taskAfterSecond.status).toBe('APPROVED')
  })
})
