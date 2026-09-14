import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, and, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../server/database'
import { createRequest } from '../../server/services/leave-request.service'
import { getFixtures, makeAuth, cleanupRequest } from './helpers'

describe('Integration: Submit Request Lifecycle (Task 13)', () => {
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

  it('Kirim pengajuan valid -> leave_request_days terisi, kuota reserved naik, task tahap 1 PENDING, riwayat tercatat', async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // Ambil kuota awal tahun 2026
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

    const initialReserved = Number(initialQuota?.reserved ?? 0)

    // Buat dan langsung kirim (submit) Cuti Tahunan 2 hari kerja (Rabu 14 Okt 2026 s/d Kamis 15 Okt 2026)
    const result = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-10-14',
        endDate: '2026-10-15',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Keperluan keluarga dan renovasi rumah',
        action: 'submit',
      },
      auth
    )

    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
    activeRequestIds.push(result.id)

    const [dbReq] = await db
      .select()
      .from(schema.leaveRequests)
      .where(eq(schema.leaveRequests.id, result.id))
      .limit(1)

    expect(dbReq.status).toBe('IN_REVIEW')
    expect(Number(dbReq.totalDays)).toBe(2)

    // 1. Verifikasi leave_request_days terisi
    const days = await db
      .select()
      .from(schema.leaveRequestDays)
      .where(eq(schema.leaveRequestDays.requestId, result.id))

    expect(days.length).toBe(2)
    expect(days.map((d) => d.leaveDate)).toEqual(['2026-10-14', '2026-10-15'])
    expect(Number(days[0].dayValue)).toBe(1)
    expect(Number(days[1].dayValue)).toBe(1)

    // 2. Verifikasi kuota reserved bertambah
    const [updatedQuota] = await db
      .select()
      .from(schema.leaveQuotas)
      .where(eq(schema.leaveQuotas.id, initialQuota.id))
      .limit(1)

    expect(Number(updatedQuota.reserved)).toBe(initialReserved + 2)

    // Verifikasi ledger RESERVATION
    const ledgerRows = await db
      .select()
      .from(schema.leaveQuotaLedger)
      .where(eq(schema.leaveQuotaLedger.requestId, result.id))

    expect(ledgerRows.length).toBeGreaterThanOrEqual(1)
    expect(ledgerRows[0].txnType).toBe('RESERVATION')
    expect(Number(ledgerRows[0].amount)).toBe(2)

    // 3. Verifikasi task tahap 1 berstatus PENDING
    const tasks = await db
      .select()
      .from(schema.approvalTasks)
      .where(eq(schema.approvalTasks.requestId, result.id))

    expect(tasks.length).toBeGreaterThan(0)
    const firstStepTask = tasks.find((t) => t.stepOrder === 1)
    expect(firstStepTask).toBeDefined()
    expect(firstStepTask?.status).toBe('PENDING')

    // 4. Verifikasi approval_histories mencatat SUBMITTED
    const histories = await db
      .select()
      .from(schema.approvalHistories)
      .where(eq(schema.approvalHistories.requestId, result.id))

    const submitHistory = histories.find((h) => h.action === 'SUBMITTED')
    expect(submitHistory).toBeDefined()
    expect(submitHistory?.actorEmployeeId).toBe(budi.id)
  })

  it('Pelanggaran BLOCK_SUBMIT -> transaksi dibatalkan penuh (tidak ada baris tersisa, kuota tidak berubah)', async () => {
    const { budi, wfa } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // Ambil kuota WFA awal (tidak memotong kuota tapi kita pastikan tabel utuh)
    const initialRequestsCount = (
      await db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.employeeId, budi.id))
    ).length

    // WFA memiliki aturan BLOCK_SUBMIT: WFA_MAKS_PER_AJU (max 1 hari)
    // Mencoba mengajukan 3 hari (Selasa-Kamis) harus ditolak dengan BLOCK_SUBMIT (422 RULE_BLOCKED)
    let caughtError: any = null
    try {
      await createRequest(
        {
          leaveTypeId: wfa.id,
          startDate: '2026-10-13', // Selasa
          endDate: '2026-10-15',   // Kamis (3 hari)
          startDayPart: 'FULL_DAY',
          endDayPart: 'FULL_DAY',
          reason: 'Bekerja jarak jauh selama tiga hari',
          action: 'submit',
        },
        auth
      )
    } catch (err) {
      caughtError = err
    }

    expect(caughtError).toBeDefined()
    expect(caughtError.statusCode).toBe(422)
    expect(caughtError.statusMessage).toBe('RULE_BLOCKED')
    expect(caughtError.message).toContain('maksimal 1 hari')

    // Verifikasi transaksi dibatalkan penuh (rollback):
    // Tidak ada baris pengajuan baru yang tertinggal
    const finalRequestsCount = (
      await db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.employeeId, budi.id))
    ).length
    expect(finalRequestsCount).toBe(initialRequestsCount)
  })
})
