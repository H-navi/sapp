import { eq, sql } from 'drizzle-orm'
import * as schema from '../../database/schema'

/**
 * Keputusan akhir pengajuan perizinan (APPROVED atau REJECTED),
 * beserta penyelesaian mutasi kuota transaksional dan pembatalan task tersisa.
 */
export async function finalizeRequest(
  tx: any,
  requestId: string,
  status: 'APPROVED' | 'REJECTED' | 'EXPIRED',
  source: 'USER' | 'SYSTEM_AUTO' | 'ADMIN_OVERRIDE',
  reason: string,
  decidedBy?: string | null
): Promise<void> {
  // 1. Ambil data pengajuan dan jenis izin
  const reqRows = (await tx.execute(sql`
    SELECT r.id,
           r.request_number,
           r.employee_id,
           r.leave_type_id,
           r.total_days::numeric AS total_days,
           r.start_date::text AS start_date,
           lt.deducts_quota
    FROM leave_requests r
    JOIN leave_types lt ON lt.id = r.leave_type_id
    WHERE r.id = ${requestId}::uuid
    LIMIT 1
  `)) as any[]

  if (reqRows.length === 0) {
    throw createError({ statusCode: 404, message: 'Pengajuan tidak ditemukan' })
  }

  const req = reqRows[0]
  const totalDays = Number(req.total_days)
  const isAutoDecided = source !== 'USER'

  // 2. Perbarui status leave_requests
  await tx
    .update(schema.leaveRequests)
    .set({
      status,
      decidedAt: new Date(),
      decidedBy: decidedBy ?? null,
      decisionSource: source as any,
      decisionReason: reason,
      isAutoDecided,
      currentStepOrder: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.leaveRequests.id, requestId))

  // 3. Penyelesaian kuota jika jenis izin memotong kuota
  if (req.deducts_quota && totalDays > 0) {
    const year = new Date(req.start_date).getFullYear()

    if (status === 'APPROVED') {
      // Pindahkan kuota dari RESERVED ke USED
      const updatedQuotas = (await tx.execute(sql`
        UPDATE leave_quotas
        SET reserved = GREATEST(0, reserved - ${totalDays}),
            used = used + ${totalDays},
            updated_at = NOW()
        WHERE employee_id = ${req.employee_id}::uuid
          AND leave_type_id = ${req.leave_type_id}::uuid
          AND period_year = ${year}::smallint
        RETURNING id, balance::numeric AS balance
      `)) as any[]

      if (updatedQuotas.length > 0) {
        const q = updatedQuotas[0]
        await tx.insert(schema.leaveQuotaLedger).values({
          quotaId: q.id,
          requestId: req.id,
          txnType: 'USAGE',
          amount: String(totalDays),
          balanceAfter: String(q.balance),
          note: `Pemakaian cuti disetujui untuk ${req.request_number}`,
        })
      }
    } else if (status === 'REJECTED' || status === 'EXPIRED') {
      // Kembalikan kuota yang dicadangkan (RELEASE)
      const updatedQuotas = (await tx.execute(sql`
        UPDATE leave_quotas
        SET reserved = GREATEST(0, reserved - ${totalDays}),
            updated_at = NOW()
        WHERE employee_id = ${req.employee_id}::uuid
          AND leave_type_id = ${req.leave_type_id}::uuid
          AND period_year = ${year}::smallint
        RETURNING id, balance::numeric AS balance
      `)) as any[]

      if (updatedQuotas.length > 0) {
        const q = updatedQuotas[0]
        await tx.insert(schema.leaveQuotaLedger).values({
          quotaId: q.id,
          requestId: req.id,
          txnType: 'RELEASE',
          amount: String(totalDays),
          balanceAfter: String(q.balance),
          note: `Pelepasan kuota cadangan karena pengajuan ${req.request_number} ${status === 'EXPIRED' ? 'kedaluwarsa' : 'ditolak'}: ${reason}`,
        })
      }
    }
  }

  // 4. Batalkan seluruh tugas persetujuan yang masih WAITING atau PENDING
  await tx.execute(sql`
    UPDATE approval_tasks
    SET status = 'CANCELLED',
        updated_at = NOW()
    WHERE request_id = ${requestId}::uuid
      AND status IN ('WAITING', 'PENDING')
  `)

  // 5. Tulis riwayat keputusan ke approval_histories
  const histAction =
    status === 'APPROVED'
      ? source === 'SYSTEM_AUTO'
        ? 'AUTO_APPROVED'
        : 'APPROVED'
      : status === 'EXPIRED'
        ? 'EXPIRED'
        : source === 'SYSTEM_AUTO'
          ? 'AUTO_REJECTED'
          : 'REJECTED'

  await tx.insert(schema.approvalHistories).values({
    requestId: req.id,
    action: histAction,
    fromStatus: 'IN_REVIEW',
    toStatus: status as any,
    actorEmployeeId: decidedBy ?? null,
    actorType: source === 'USER' ? 'USER' : 'SYSTEM',
    reason,
    note: reason,
  })
}
