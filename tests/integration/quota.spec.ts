import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, and, sql, desc } from 'drizzle-orm'
import { useDatabase, schema } from '../../server/database'
import { createRequest } from '../../server/services/leave-request.service'
import { actOnTask } from '../../server/services/approval/engine'
import { getFixtures, makeAuth, cleanupRequest } from './helpers'

describe('Integration: Quota Lifecycle & Ledger Reconciliation (Task 13)', () => {
  const activeRequestIds: string[] = []

  beforeEach(async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    await db.execute(sql`
      DELETE FROM leave_requests WHERE employee_id = ${budi.id}::uuid
    `)
    const [q] = await db
      .select({ id: schema.leaveQuotas.id })
      .from(schema.leaveQuotas)
      .where(
        and(
          eq(schema.leaveQuotas.employeeId, budi.id),
          eq(schema.leaveQuotas.leaveTypeId, cutiTahunan.id),
          eq(schema.leaveQuotas.periodYear, 2026)
        )
      )
      .limit(1)

    if (q) {
      await db.execute(sql`
        DELETE FROM leave_quota_ledger
        WHERE quota_id = ${q.id}::uuid
          AND txn_type != 'ALLOCATION'
      `)
    }

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

  it('Siklus lengkap: alokasi -> reservasi -> pemakaian -> pembatalan/pelepasan, balance selalu konsisten dengan ledger', async () => {
    const { budi, andi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // Helper: Ambil data kuota saat ini dan cek konsistensi formula generated column
    async function getQuotaState() {
      const [q] = await db
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

      const allocated = Number(q.allocated)
      const carriedOver = Number(q.carriedOver)
      const adjustment = Number(q.adjustment)
      const reserved = Number(q.reserved)
      const used = Number(q.used)
      const balance = Number(q.balance)

      // Verifikasi konsistensi internal formula balance
      const expectedFormulaBalance = allocated + carriedOver + adjustment - reserved - used
      expect(balance).toBe(expectedFormulaBalance)

      // Ambil transaksi ledger terbaru
      const [latestLedger] = await db
        .select()
        .from(schema.leaveQuotaLedger)
        .where(eq(schema.leaveQuotaLedger.quotaId, q.id))
        .orderBy(desc(schema.leaveQuotaLedger.id))
        .limit(1)

      if (latestLedger) {
        expect(balance).toBe(Number(latestLedger.balanceAfter))
      }

      return { q, allocated, reserved, used, balance, latestLedger }
    }

    // --- FASE 1: ALOKASI AWAL ---
    const fase1 = await getQuotaState()
    expect(fase1.allocated).toBe(12)
    expect(fase1.reserved).toBe(0)
    expect(fase1.used).toBe(0)
    expect(fase1.balance).toBe(12)

    // --- FASE 2: RESERVASI (Pengajuan Cuti 3 hari kerja) ---
    // Selasa 27 Okt s/d Kamis 29 Okt 2026 = 3 hari kerja
    const req1 = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-10-27',
        endDate: '2026-10-29',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Pengajuan cuti 3 hari untuk uji siklus reservasi',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req1.id)

    const fase2 = await getQuotaState()
    expect(fase2.allocated).toBe(12)
    expect(fase2.reserved).toBe(3) // Naik 3
    expect(fase2.used).toBe(0)
    expect(fase2.balance).toBe(9)  // 12 - 3 = 9
    expect(fase2.latestLedger?.txnType).toBe('RESERVATION')
    expect(Number(fase2.latestLedger?.amount)).toBe(3)
    expect(Number(fase2.latestLedger?.balanceAfter)).toBe(9)

    // --- FASE 3: PEMAKAIAN (Persetujuan Penuh Permohonan) ---
    // Selesaikan persetujuan tahap 1 (Andi)
    const [taskStep1] = await db
      .select()
      .from(schema.approvalTasks)
      .where(and(eq(schema.approvalTasks.requestId, req1.id), eq(schema.approvalTasks.stepOrder, 1)))
      .limit(1)

    await actOnTask({
      taskId: taskStep1.id,
      actorEmployeeId: andi.id,
      action: 'APPROVE',
      note: 'Disetujui tahap 1',
    })

    // Selesaikan persetujuan tahap 2 (Rina)
    const { rina } = await getFixtures()
    const [taskStep2] = await db
      .select()
      .from(schema.approvalTasks)
      .where(and(eq(schema.approvalTasks.requestId, req1.id), eq(schema.approvalTasks.stepOrder, 2)))
      .limit(1)

    await actOnTask({
      taskId: taskStep2.id,
      actorEmployeeId: rina.id,
      action: 'APPROVE',
      note: 'Disetujui tahap 2 (final approval)',
    })

    const fase3 = await getQuotaState()
    expect(fase3.allocated).toBe(12)
    expect(fase3.reserved).toBe(0) // Kuota reservasi dipindahkan
    expect(fase3.used).toBe(3)     // Menjadi pemakaian (used = 3)
    expect(fase3.balance).toBe(9)  // Sisa kuota tetap 9
    expect(fase3.latestLedger?.txnType).toBe('USAGE')
    expect(Number(fase3.latestLedger?.amount)).toBe(3)
    expect(Number(fase3.latestLedger?.balanceAfter)).toBe(9)

    // --- FASE 4: PEMBATALAN / PELEPASAN KUOTA (Pengajuan baru ditolak) ---
    // Budi mengajukan permohonan kedua 2 hari kerja (Selasa 3 Nov s/d Rabu 4 Nov 2026)
    const req2 = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-11-03',
        endDate: '2026-11-04',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Pengajuan cuti kedua untuk diuji penolakan dan pelepasan',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req2.id)

    // Sesaat setelah submit req2: reserved = 2, balance = 7
    const fase4Sub = await getQuotaState()
    expect(fase4Sub.reserved).toBe(2)
    expect(fase4Sub.used).toBe(3)
    expect(fase4Sub.balance).toBe(7) // 12 - 2 - 3 = 7
    expect(fase4Sub.latestLedger?.txnType).toBe('RESERVATION')

    // Atasan menolak req2 di tahap 1
    const [taskReq2Step1] = await db
      .select()
      .from(schema.approvalTasks)
      .where(and(eq(schema.approvalTasks.requestId, req2.id), eq(schema.approvalTasks.stepOrder, 1)))
      .limit(1)

    await actOnTask({
      taskId: taskReq2Step1.id,
      actorEmployeeId: andi.id,
      action: 'REJECT',
      note: 'Ditolak untuk menguji pengembalian kuota cadangan',
    })

    // Sesaat setelah penolakan: kuota yang dicadangkan dilepaskan kembali (RELEASE)
    const fase4Final = await getQuotaState()
    expect(fase4Final.reserved).toBe(0) // Dicadangkan kembali 0
    expect(fase4Final.used).toBe(3)     // Pemakaian sebelumnya tetap 3
    expect(fase4Final.balance).toBe(9)  // Balance kembali menjadi 9 (12 - 0 - 3 = 9)
    expect(fase4Final.latestLedger?.txnType).toBe('RELEASE')
    expect(Number(fase4Final.latestLedger?.amount)).toBe(2)
    expect(Number(fase4Final.latestLedger?.balanceAfter)).toBe(9)
  })
})
