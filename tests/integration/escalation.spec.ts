import { describe, it, expect, afterEach } from 'vitest'
import { eq, and, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../server/database'
import { createRequest } from '../../server/services/leave-request.service'
import escalationTask from '../../server/tasks/approval/escalation'
import { getFixtures, makeAuth, cleanupRequest } from './helpers'

describe('Integration: SLA Escalation & Auto-Step Approval (Task 13)', () => {
  const activeRequestIds: string[] = []

  afterEach(async () => {
    while (activeRequestIds.length > 0) {
      const id = activeRequestIds.pop()
      await cleanupRequest(id)
    }
  })

  it('due_at lewat + AUTO_APPROVE -> tahap disetujui sistem, tahap berikutnya aktif', async () => {
    const { budi, rina, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // 1. Buat pengajuan 2 hari cuti tahunan (WF_CUTI_PENDEK: Tahap 1 Atasan, Tahap 2 Kepala Divisi)
    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-11-19',
        endDate: '2026-11-20',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Uji eskalasi SLA tahap 1 auto approve',
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

    const [step2Task] = await db
      .select()
      .from(schema.approvalTasks)
      .where(and(eq(schema.approvalTasks.requestId, req.id), eq(schema.approvalTasks.stepOrder, 2)))
      .limit(1)

    expect(step1Task.status).toBe('PENDING')
    expect(step2Task.status).toBe('WAITING')

    // 2. Simulasikan batas waktu SLA tahap 1 telah terlewati (due_at = 1 jam yang lalu)
    await db.execute(sql`
      UPDATE approval_tasks
      SET due_at = NOW() - INTERVAL '1 hour'
      WHERE id = ${step1Task.id}::uuid
    `)

    // 3. Jalankan scheduler task eskalasi
    const runResult = await (escalationTask as any).run()
    expect(runResult).toBeDefined()
    expect(runResult.processedCount).toBeGreaterThanOrEqual(1)

    // 4. Verifikasi Tahap 1:
    // - Status berubah menjadi APPROVED
    // - action_source menjadi SYSTEM_AUTO
    const [updatedStep1] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step1Task.id))
      .limit(1)

    expect(updatedStep1.status).toBe('APPROVED')
    expect(updatedStep1.actionSource).toBe('SYSTEM_AUTO')
    expect(updatedStep1.actionNote).toContain('Disetujui otomatis')

    // 5. Verifikasi approval_histories mencatat AUTO_APPROVED
    const histories = await db
      .select()
      .from(schema.approvalHistories)
      .where(
        and(
          eq(schema.approvalHistories.requestId, req.id),
          eq(schema.approvalHistories.taskId, step1Task.id),
          eq(schema.approvalHistories.action, 'AUTO_APPROVED')
        )
      )

    expect(histories.length).toBeGreaterThanOrEqual(1)
    expect(histories[0].actorType).toBe('SYSTEM')

    // 6. Verifikasi Tahap 2 otomatis diaktifkan menjadi PENDING
    const [updatedStep2] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step2Task.id))
      .limit(1)

    expect(updatedStep2.status).toBe('PENDING')

    // Verifikasi assignee tahap 2 terisi
    const step2Assignees = await db
      .select()
      .from(schema.approvalTaskAssignees)
      .where(eq(schema.approvalTaskAssignees.taskId, step2Task.id))

    expect(step2Assignees.length).toBeGreaterThan(0)
    expect(step2Assignees.some((a) => a.employeeId === rina.id)).toBe(true)
  })
})
