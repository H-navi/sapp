import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, and, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../server/database'
import { createRequest } from '../../server/services/leave-request.service'
import { actOnTask } from '../../server/services/approval/engine'
import { getFixtures, makeAuth, cleanupRequest } from './helpers'

describe('Integration: Request Rejection & Cascading Cancellation (Task 13)', () => {
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

  it('Tolak di tahap 2 -> tahap 3 CANCELLED, kuota kembali, ledger RELEASE', async () => {
    const { budi, andi, rina, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // Catat kuota awal Budi tahun 2026
    const [initialQuota] = await db
      .select()
      .from(schema.leaveQuotas)
      .where(
        and(
          eq(schema.leaveQuotas.employeeId, budi.id),
          eq(schema.leaveQuotas.leaveTypeId, cutiTahunan.id),
          eq(schema.leaveQuotas.periodYear, 2026)
        )
      )
      .limit(1)

    const initialReserved = Number(initialQuota.reserved)
    const initialUsed = Number(initialQuota.used)

    // 1. Budi mengajukan cuti 6 hari kerja (Senin 5 Okt 2026 s/d Senin 12 Okt 2026 = 6 hari kerja)
    // Ini mencocokkan alur WF_CUTI_PANJANG (4 tahap: Atasan, Kepala Divisi, HRD, Direktur)
    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-10-05',
        endDate: '2026-10-12',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Pengajuan cuti panjang 6 hari kerja untuk pengujian penolakan bertingkat',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req.id)

    // Kuota reserved naik sebesar 6
    const [reservedQuota] = await db
      .select()
      .from(schema.leaveQuotas)
      .where(eq(schema.leaveQuotas.id, initialQuota.id))
      .limit(1)
    expect(Number(reservedQuota.reserved)).toBe(initialReserved + 6)

    // Ambil seluruh tugas
    const allTasks = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.requestId, req.id))

    expect(allTasks.length).toBeGreaterThanOrEqual(3)
    const step1 = allTasks.find((t) => t.stepOrder === 1)!
    const step2 = allTasks.find((t) => t.stepOrder === 2)!
    const step3 = allTasks.find((t) => t.stepOrder === 3)!

    expect(step1.status).toBe('PENDING')
    expect(step2.status).toBe('WAITING')
    expect(step3.status).toBe('WAITING')

    // 2. Andi (Atasan Langsung) menyetujui Tahap 1
    const resStep1 = await actOnTask({
      taskId: step1.id,
      actorEmployeeId: andi.id,
      action: 'APPROVE',
      note: 'Disetujui di tahap 1 oleh atasan langsung',
    })
    expect(resStep1.success).toBe(true)

    // Verifikasi Tahap 2 sekarang PENDING
    const [step2Pending] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step2.id))
      .limit(1)
    expect(step2Pending.status).toBe('PENDING')

    // 3. Rina (Kepala Divisi) MENOLAK di Tahap 2
    const rejectReason = 'Ditolak di tahap 2 karena beban proyek sprint Q4 sedang padat'
    const resStep2 = await actOnTask({
      taskId: step2.id,
      actorEmployeeId: rina.id,
      action: 'REJECT',
      note: rejectReason,
    })
    expect(resStep2.success).toBe(true)
    expect(resStep2.requestStatus).toBe('REJECTED')

    // 4. Verifikasi status tugas:
    // - Tahap 2 menjadi REJECTED
    // - Tahap 3 (dan tahap berikutnya) menjadi CANCELLED
    const [step2After] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step2.id))
      .limit(1)
    expect(step2After.status).toBe('REJECTED')

    const [step3After] = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.id, step3.id))
      .limit(1)
    expect(step3After.status).toBe('CANCELLED')

    // 5. Verifikasi status pengajuan menjadi REJECTED
    const [reqAfter] = await db
      .select()
      .from(schema.leaveRequests)
      .where(eq(schema.leaveRequests.id, req.id))
      .limit(1)
    expect(reqAfter.status).toBe('REJECTED')
    expect(reqAfter.decisionReason).toBe(rejectReason)

    // 6. Verifikasi kuota dikembalikan (reserved turun kembali ke semula, used tidak bertambah)
    const [finalQuota] = await db
      .select()
      .from(schema.leaveQuotas)
      .where(eq(schema.leaveQuotas.id, initialQuota.id))
      .limit(1)
    expect(Number(finalQuota.reserved)).toBe(initialReserved)
    expect(Number(finalQuota.used)).toBe(initialUsed)

    // 7. Verifikasi transaksi RELEASE tercatat di leave_quota_ledger
    const releaseLedgers = await db
      .select()
      .from(schema.leaveQuotaLedger)
      .where(
        and(
          eq(schema.leaveQuotaLedger.requestId, req.id),
          eq(schema.leaveQuotaLedger.txnType, 'RELEASE')
        )
      )

    expect(releaseLedgers.length).toBe(1)
    expect(Number(releaseLedgers[0].amount)).toBe(6)
    expect(releaseLedgers[0].note).toContain('Ditolak')
  })
})
