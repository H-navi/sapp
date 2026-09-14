import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, and, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../server/database'
import { createRequest } from '../../server/services/leave-request.service'
import autoDecisionTask from '../../server/tasks/approval/auto-decision'
import { getFixtures, makeAuth, cleanupRequest } from './helpers'

describe('Integration: Automated Decision Engine (Task 13)', () => {
  const activeRequestIds: string[] = []

  beforeEach(async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    // Pastikan database dan kuota Budi bersih di setiap test
    await db.execute(sql`
      DELETE FROM leave_requests WHERE employee_id = ${budi.id}::uuid
    `)
    await db.execute(sql`
      UPDATE leave_quotas
      SET allocated = 12, reserved = 0, used = 0, updated_at = NOW()
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

  it('1. Deadline lewat, semua aturan lolos -> APPROVED, is_auto_decided=true', async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // Budi mengajukan 2 hari cuti tahunan yang memenuhi semua aturan (Rabu-Kamis, > 3 hari notice)
    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-10-21', // Rabu
        endDate: '2026-10-22',   // Kamis
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Cuti tahunan yang memenuhi semua aturan untuk auto approve',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req.id)

    // Simulasikan deadline pengajuan telah terlewati
    await db.execute(sql`
      UPDATE leave_requests
      SET final_deadline_at = NOW() - INTERVAL '1 hour'
      WHERE id = ${req.id}::uuid
    `)

    // Jalankan task auto-decision
    const res = await (autoDecisionTask as any).run()
    expect(res).toBeDefined()
    expect(res.processedCount).toBeGreaterThanOrEqual(1)

    // Verifikasi pengajuan disetujui otomatis
    const [updatedReq] = await db
      .select()
      .from(schema.leaveRequests)
      .where(eq(schema.leaveRequests.id, req.id))
      .limit(1)

    expect(updatedReq.status).toBe('APPROVED')
    expect(updatedReq.isAutoDecided).toBe(true)
    expect(updatedReq.decisionSource).toBe('SYSTEM_AUTO')
    expect(updatedReq.decisionReason).toContain('Disetujui otomatis oleh sistem')

    // Verifikasi kuota dipindahkan ke used dan ledger USAGE dicatat
    const [quota] = await db
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

    expect(Number(quota.used)).toBeGreaterThanOrEqual(2)

    const usageLedgers = await db
      .select()
      .from(schema.leaveQuotaLedger)
      .where(
        and(
          eq(schema.leaveQuotaLedger.requestId, req.id),
          eq(schema.leaveQuotaLedger.txnType, 'USAGE')
        )
      )

    expect(usageLedgers.length).toBe(1)
    expect(Number(usageLedgers[0].amount)).toBe(2)
  })

  it('2. Deadline lewat, WFA hari Senin -> REJECTED, alasan memuat kalimat aturan', async () => {
    const { budi, wfa } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // WFA pada hari Senin: 19 Oktober 2026 adalah hari Senin
    // Aturan WFA_HARI_BOLEH: ALLOWED_WEEKDAYS [2, 3, 4] (Selasa, Rabu, Kamis) beraksi AUTO_REJECT
    const req = await createRequest(
      {
        leaveTypeId: wfa.id,
        startDate: '2026-10-19', // Senin
        endDate: '2026-10-19',   // Senin (1 hari)
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'WFA hari Senin untuk pengujian penolakan otomatis aturan hari boleh',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req.id)

    // Simulasikan deadline lewat
    await db.execute(sql`
      UPDATE leave_requests
      SET final_deadline_at = NOW() - INTERVAL '1 hour'
      WHERE id = ${req.id}::uuid
    `)

    // Jalankan task auto-decision
    const res = await (autoDecisionTask as any).run()
    expect(res).toBeDefined()
    expect(res.processedCount).toBeGreaterThanOrEqual(1)

    // Verifikasi pengajuan ditolak otomatis dengan kalimat aturan yang dilanggar
    const [updatedReq] = await db
      .select()
      .from(schema.leaveRequests)
      .where(eq(schema.leaveRequests.id, req.id))
      .limit(1)

    expect(updatedReq.status).toBe('REJECTED')
    expect(updatedReq.isAutoDecided).toBe(true)
    expect(updatedReq.decisionSource).toBe('SYSTEM_AUTO')
    // Alasan memuat kalimat aturan: "WFA hanya diperbolehkan pada hari Selasa, Rabu, dan Kamis"
    expect(updatedReq.decisionReason).toContain('Selasa, Rabu, dan Kamis')
  })

  it('3. Kuota habis oleh pengajuan lain sejak submit -> auto reject dengan alasan kuota', async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // Budi mengajukan 2 hari cuti (16-17 Desember 2026, Rabu-Kamis)
    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-12-16',
        endDate: '2026-12-17',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Cuti tahunan yang kuotanya habis sebelum diputuskan',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req.id)

    try {
      // Simulasikan sisa kuota habis oleh transaksi lain (used diisi 10 sehingga balance = 12 - 2 - 10 = 0)
      await db.execute(sql`
        UPDATE leave_quotas
        SET used = 10
        WHERE employee_id = ${budi.id}::uuid
          AND leave_type_id = ${cutiTahunan.id}::uuid
          AND period_year = 2026::smallint
      `)

      // Simulasikan deadline lewat
      await db.execute(sql`
        UPDATE leave_requests
        SET final_deadline_at = NOW() - INTERVAL '1 hour'
        WHERE id = ${req.id}::uuid
      `)

      // Jalankan auto-decision
      await (autoDecisionTask as any).run()

      const [updatedReq] = await db
        .select()
        .from(schema.leaveRequests)
        .where(eq(schema.leaveRequests.id, req.id))
        .limit(1)

      // Karena kuota habis, evaluasi ulang pada phase AUTO_DECISION gagal
      expect(updatedReq.status).toBe('REJECTED')
      expect(updatedReq.isAutoDecided).toBe(true)
      expect(updatedReq.decisionReason.toLowerCase()).toContain('kuota')
    } finally {
      // Kembalikan kuota untuk kebersihan data
      await db.execute(sql`
        UPDATE leave_quotas
        SET allocated = 12, reserved = 0, used = 0
        WHERE employee_id = ${budi.id}::uuid
          AND leave_type_id = ${cutiTahunan.id}::uuid
          AND period_year = 2026::smallint
      `)
    }
  })

  it('4. Ada aturan REQUIRE_APPROVAL gagal -> tidak diputuskan otomatis', async () => {
    const { budi, cutiTahunan } = await getFixtures()
    const db = useDatabase()
    const auth = makeAuth(budi)

    // Cuti tahunan 6 hari melanggar aturan CT_MAKS_PER_AJU: MAX_DAYS_PER_REQUEST max_days 5 (REQUIRE_APPROVAL)
    // 6 hari kerja: Selasa 1 Des 2026 s/d Selasa 8 Des 2026
    const req = await createRequest(
      {
        leaveTypeId: cutiTahunan.id,
        startDate: '2026-12-01',
        endDate: '2026-12-08',
        startDayPart: 'FULL_DAY',
        endDayPart: 'FULL_DAY',
        reason: 'Cuti 6 hari yang melanggar batas per pengajuan dan mewajibkan approval manual',
        action: 'submit',
      },
      auth
    )
    activeRequestIds.push(req.id)

    // Simulasikan deadline lewat
    await db.execute(sql`
      UPDATE leave_requests
      SET final_deadline_at = NOW() - INTERVAL '1 hour'
      WHERE id = ${req.id}::uuid
    `)

    // Jalankan auto-decision
    await (autoDecisionTask as any).run()

    const [updatedReq] = await db
      .select()
      .from(schema.leaveRequests)
      .where(eq(schema.leaveRequests.id, req.id))
      .limit(1)

    // Status TETAP IN_REVIEW (tidak auto approve ataupun auto reject!)
    expect(updatedReq.status).toBe('IN_REVIEW')
    expect(updatedReq.isAutoDecided).toBe(false)

    // Riwayat mencatat AUTO_DECISION_BLOCKED
    const blockedHistory = await db
      .select()
      .from(schema.approvalHistories)
      .where(
        and(
          eq(schema.approvalHistories.requestId, req.id),
          eq(schema.approvalHistories.action, 'AUTO_DECISION_BLOCKED')
        )
      )

    expect(blockedHistory.length).toBeGreaterThanOrEqual(1)
    expect(blockedHistory[0].note).toContain('Keputusan otomatis dicegah')
  })
})
