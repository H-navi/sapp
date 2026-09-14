import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq, and, or, sql, desc, asc, lte, gte, isNull } from 'drizzle-orm'
import type { MultiPartData } from 'h3'
import { useDatabase, schema } from '../database'
import type { Transaction } from '../database'
import { withTransaction } from '../utils/transaction'
import { writeAuditLog } from '../utils/audit'
import type { AuthContext } from '../utils/auth'
import { expandLeaveDays, summarizeDays, addWorkingHours } from '../utils/calendar'
import { getAllowedLeaveTypes } from './eligibility.service'
import { evaluateRules } from './rule-engine.service'
import { startApprovalFlow } from './approval-engine.service'
import type { LeaveRequestInput, LeaveRequestQuery } from '../validators/request'

const STORAGE_ATTACHMENTS_DIR = path.resolve(process.cwd(), 'storage', 'attachments')

// Helper pastikan direktori ada
function ensureStorageDir(reqId: string) {
  const dir = path.join(STORAGE_ATTACHMENTS_DIR, reqId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// Validasi Magic Bytes
function detectMimeTypeFromBytes(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf'
  }
  return null
}

export async function getFormOptions(employeeId: string) {
  const db = useDatabase()

  // 1. Cek hak umum pegawai
  const [emp] = await db
    .select({
      id: schema.employees.id,
      departmentId: schema.employees.departmentId,
      canSubmitRequest: schema.employees.canSubmitRequest,
      isActive: schema.employees.isActive,
    })
    .from(schema.employees)
    .where(eq(schema.employees.id, employeeId))
    .limit(1)

  if (!emp || !emp.isActive) {
    throw createError({ statusCode: 403, statusMessage: 'INACTIVE_EMPLOYEE', message: 'Pegawai tidak aktif.' })
  }

  if (!emp.canSubmitRequest) {
    throw createError({
      statusCode: 403,
      statusMessage: 'SUBMIT_RIGHT_REVOKED',
      message: 'Hak Anda untuk mengajukan perizinan sedang dinonaktifkan oleh administrator.',
    })
  }

  // 2. Ambil jenis izin yang diizinkan (4-layer eligibility)
  const allowedLeaveTypes = await getAllowedLeaveTypes(employeeId)

  // 3. Ambil sisa kuota tahun berjalan
  const currentYear = new Date().getFullYear()
  const quotas = await db
    .select({
      leaveTypeId: schema.leaveQuotas.leaveTypeId,
      periodYear: schema.leaveQuotas.periodYear,
      allocated: schema.leaveQuotas.allocated,
      carriedOver: schema.leaveQuotas.carriedOver,
      adjustment: schema.leaveQuotas.adjustment,
      reserved: schema.leaveQuotas.reserved,
      used: schema.leaveQuotas.used,
      balance: schema.leaveQuotas.balance,
    })
    .from(schema.leaveQuotas)
    .where(
      and(
        eq(schema.leaveQuotas.employeeId, employeeId),
        eq(schema.leaveQuotas.periodYear, currentYear)
      )
    )

  // 4. Ambil rekan satu departemen untuk pelimpahan tugas (delegasi)
  let peers: any[] = []
  if (emp.departmentId) {
    peers = await db
      .select({
        id: schema.employees.id,
        nip: schema.employees.nip,
        fullName: schema.employees.fullName,
        positionName: schema.positions.name,
      })
      .from(schema.employees)
      .leftJoin(schema.positions, eq(schema.employees.positionId, schema.positions.id))
      .where(
        and(
          eq(schema.employees.departmentId, emp.departmentId),
          eq(schema.employees.isActive, true),
          sql`${schema.employees.id} != ${employeeId}`
        )
      )
      .orderBy(asc(schema.employees.fullName))
  }

  return {
    canSubmit: true,
    leaveTypes: allowedLeaveTypes,
    quotas,
    peers,
  }
}

export async function previewRequest(input: LeaveRequestInput, actor: AuthContext) {
  if (!actor.employeeId) {
    throw createError({ statusCode: 400, message: 'User tidak tertaut dengan data pegawai.' })
  }

  const db = useDatabase()

  // Ambil data jenis izin
  const [lt] = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, input.leaveTypeId))
    .limit(1)

  if (!lt) {
    throw createError({ statusCode: 404, message: 'Jenis izin tidak ditemukan.' })
  }

  // Uraikan hari
  const days = await expandLeaveDays(
    db,
    input.startDate,
    input.endDate,
    input.startDayPart,
    input.endDayPart
  )

  const summary = summarizeDays(days, lt.countsWorkingDaysOnly)

  // Ambil kebijakan aktif
  const [policy] = await db
    .select()
    .from(schema.leavePolicies)
    .where(
      and(
        eq(schema.leavePolicies.leaveTypeId, input.leaveTypeId),
        eq(schema.leavePolicies.isActive, true),
        lte(schema.leavePolicies.effectiveFrom, input.startDate),
        or(isNull(schema.leavePolicies.effectiveTo), gte(schema.leavePolicies.effectiveTo, input.startDate))
      )
    )
    .limit(1)

  // Evaluasi aturan fase SUBMIT (dry-run)
  const ruleResult = await evaluateRules({
    tx: db as any,
    employeeId: actor.employeeId,
    leaveTypeId: input.leaveTypeId,
    policyId: policy?.id,
    startDate: input.startDate,
    endDate: input.endDate,
    totalDays: summary.totalDays,
    workingDays: summary.workingDays,
    attachmentCount: 0,
    phase: 'SUBMIT',
  })

  // Cek kuota jika memotong kuota
  let quotaBalance: number | null = null
  if (lt.deductsQuota) {
    const currentYear = new Date(input.startDate).getFullYear()
    const [q] = await db
      .select({ balance: schema.leaveQuotas.balance })
      .from(schema.leaveQuotas)
      .where(
        and(
          eq(schema.leaveQuotas.employeeId, actor.employeeId),
          eq(schema.leaveQuotas.leaveTypeId, input.leaveTypeId),
          eq(schema.leaveQuotas.periodYear, currentYear)
        )
      )
      .limit(1)

    quotaBalance = q?.balance ? Number(q.balance) : 0
    if (quotaBalance < summary.totalDays) {
      ruleResult.blockingMessages.push(
        `Sisa kuota tidak mencukupi. Kuota tersedia: ${quotaBalance} hari, pengajuan: ${summary.totalDays} hari.`
      )
      ruleResult.passed = false
    }
  }

  return {
    days,
    workingDays: summary.workingDays,
    calendarDays: summary.calendarDays,
    totalDays: summary.totalDays,
    ruleResult,
    quotaBalance,
  }
}

export async function createRequest(input: LeaveRequestInput, actor: AuthContext) {
  if (!actor.employeeId) {
    throw createError({ statusCode: 400, message: 'User tidak tertaut dengan data pegawai.' })
  }

  const db = useDatabase()

  // Ambil jenis izin
  const [lt] = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, input.leaveTypeId))
    .limit(1)

  if (!lt || !lt.isActive) {
    throw createError({ statusCode: 400, message: 'Jenis izin tidak aktif atau tidak ditemukan.' })
  }

  // Hitung hari
  const days = await expandLeaveDays(
    db,
    input.startDate,
    input.endDate,
    input.startDayPart,
    input.endDayPart
  )
  const summary = summarizeDays(days, lt.countsWorkingDaysOnly)

  if (summary.totalDays <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Rentang tanggal yang dipilih tidak memiliki hari yang dapat diajukan (seluruhnya hari libur/akhir pekan).',
    })
  }

  return withTransaction(async (tx) => {
    try {
      // 1. Insert draf
      const [req] = await tx
        .insert(schema.leaveRequests)
        .values({
          requestNumber: '',
          employeeId: actor.employeeId!,
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          endDate: input.endDate,
          startDayPart: input.startDayPart,
          endDayPart: input.endDayPart,
          totalDays: String(summary.totalDays),
          workingDays: String(summary.workingDays),
          reason: input.reason,
          addressDuringLeave: input.addressDuringLeave ?? null,
          contactPhone: input.contactPhone ?? null,
          delegateEmployeeId: input.delegateEmployeeId ?? null,
          status: 'DRAFT',
        })
        .returning()

      if (!req) {
        throw createError({ statusCode: 500, message: 'Gagal membuat pengajuan.' })
      }

      // 2. Simpan rincian hari (leave_request_days)
      for (const d of days) {
        await tx.insert(schema.leaveRequestDays).values({
          requestId: req.id,
          leaveDate: d.date,
          dayPart: d.dayPart,
          dayValue: String(d.dayValue),
          isWorkingDay: d.isWorkingDay,
          isHoliday: d.isHoliday,
        })
      }

      await writeAuditLog(tx, {
        actorUserId: actor.userId,
        action: 'CREATE_REQUEST_DRAFT',
        entityType: 'leave_requests',
        entityId: req.id,
        newValues: req,
      })

      // Jika user memilih langsung kirim ('submit')
      if (input.action === 'submit') {
        return await executeSubmitRequest(tx, req.id, actor)
      }

      return req
    } catch (err: any) {
      if (err?.code === '23P01') {
        throw createError({
          statusCode: 409,
          statusMessage: 'REQUEST_OVERLAP',
          message: 'Anda sudah memiliki pengajuan aktif pada rentang tanggal tersebut.',
        })
      }
      throw err
    }
  })
}

/**
 * Logika internal submit yang dapat dipanggil dalam transaksi yang sudah ada
 */
async function executeSubmitRequest(tx: Transaction, requestId: string, actor: AuthContext) {
  // 1. Kunci baris pengajuan: SELECT ... FOR UPDATE
  const [req] = await tx
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, requestId))
    .for('update')
    .limit(1)

  if (!req) {
    throw createError({ statusCode: 404, message: 'Pengajuan tidak ditemukan.' })
  }

  if (req.status !== 'DRAFT') {
    throw createError({
      statusCode: 400,
      statusMessage: 'INVALID_STATUS',
      message: `Hanya draf yang dapat dikirim (status saat ini: ${req.status}).`,
    })
  }

  // 2. Cek hak ajukan ulang lewat eligibility.service
  const allowed = await getAllowedLeaveTypes(req.employeeId)
  const isEligible = allowed.some((lt) => lt.id === req.leaveTypeId)
  if (!isEligible) {
    throw createError({
      statusCode: 403,
      statusMessage: 'NOT_ELIGIBLE',
      message: 'Anda tidak lagi berhak mengajukan jenis izin ini.',
    })
  }

  // 3. Ambil jenis izin
  const [lt] = await tx
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, req.leaveTypeId))
    .limit(1)

  if (!lt) {
    throw createError({ statusCode: 404, message: 'Jenis izin tidak ditemukan.' })
  }

  // 4. Ambil kebijakan aktif
  const [policy] = await tx
    .select()
    .from(schema.leavePolicies)
    .where(
      and(
        eq(schema.leavePolicies.leaveTypeId, req.leaveTypeId),
        eq(schema.leavePolicies.isActive, true),
        lte(schema.leavePolicies.effectiveFrom, req.startDate),
        or(isNull(schema.leavePolicies.effectiveTo), gte(schema.leavePolicies.effectiveTo, req.startDate))
      )
    )
    .limit(1)

  // 5. Cek lampiran yang ada
  const attachments = await tx
    .select()
    .from(schema.leaveRequestAttachments)
    .where(eq(schema.leaveRequestAttachments.requestId, req.id))

  // 6. Evaluasi aturan mesin kebijakan
  const ruleResult = await evaluateRules({
    tx,
    employeeId: req.employeeId,
    leaveTypeId: req.leaveTypeId,
    policyId: policy?.id,
    startDate: req.startDate,
    endDate: req.endDate,
    totalDays: Number(req.totalDays),
    workingDays: Number(req.workingDays),
    attachmentCount: attachments.length,
    phase: 'SUBMIT',
    excludeRequestId: req.id,
  })

  // Simpan riwayat rule checks
  for (const detail of ruleResult.details) {
    await tx.insert(schema.leaveRequestRuleChecks).values({
      requestId: req.id,
      ruleId: detail.ruleId || null,
      ruleCode: detail.ruleCode,
      ruleType: detail.ruleType as any,
      passed: detail.passed,
      violationAction: detail.violationAction as any,
      message: detail.message,
      context: detail.context,
      evaluationPhase: 'SUBMIT',
    })
  }

  if (ruleResult.blockingMessages.length > 0) {
    throw createError({
      statusCode: 422,
      statusMessage: 'RULE_BLOCKED',
      message: ruleResult.blockingMessages.join('; '),
    })
  }

  // 7. Pesan kuota bila jenis izin memotong kuota
  const reqTotalDays = Number(req.totalDays)
  if (lt.deductsQuota) {
    const currentYear = new Date(req.startDate).getFullYear()

    // Kunci baris kuota
    const [quota] = await tx
      .select()
      .from(schema.leaveQuotas)
      .where(
        and(
          eq(schema.leaveQuotas.employeeId, req.employeeId),
          eq(schema.leaveQuotas.leaveTypeId, req.leaveTypeId),
          eq(schema.leaveQuotas.periodYear, currentYear)
        )
      )
      .for('update')
      .limit(1)

    if (!quota || Number(quota.balance) < reqTotalDays) {
      throw createError({
        statusCode: 422,
        statusMessage: 'QUOTA_INSUFFICIENT',
        message: 'Sisa kuota cuti Anda tidak mencukupi untuk pengajuan ini.',
      })
    }

    // Tambah reserved
    const newReserved = Number(quota.reserved) + reqTotalDays
    const [updatedQuota] = await tx
      .update(schema.leaveQuotas)
      .set({
        reserved: String(newReserved),
        updatedAt: new Date(),
      })
      .where(eq(schema.leaveQuotas.id, quota.id))
      .returning()

    // Catat mutasi di ledger
    await tx.insert(schema.leaveQuotaLedger).values({
      quotaId: quota.id,
      requestId: req.id,
      txnType: 'RESERVATION',
      amount: String(reqTotalDays),
      balanceAfter: String(Number(quota.balance) - reqTotalDays),
      note: `Reservasi pengajuan cuti ${req.requestNumber}`,
      createdBy: actor.userId,
    })
  }

  // 8. Hitung final deadline
  const overallHours = policy?.overallDeadlineHours ? Number(policy.overallDeadlineHours) : 24
  const finalDeadlineAt = addWorkingHours(new Date(), overallHours)

  // 9. Update status pengajuan ke SUBMITTED
  const [submittedReq] = await tx
    .update(schema.leaveRequests)
    .set({
      status: 'SUBMITTED',
      submittedAt: new Date(),
      policyId: policy?.id ?? null,
      policySnapshot: policy ?? null,
      finalDeadlineAt,
      ruleCheckPassed: ruleResult.passed,
      ruleCheckResult: ruleResult,
      updatedAt: new Date(),
    })
    .where(eq(schema.leaveRequests.id, req.id))
    .returning()

  // 10. Inisialisasi alur persetujuan (stub langkah 08)
  await startApprovalFlow(tx, req.id)

  // 11. Tulis approval_histories
  await tx.insert(schema.approvalHistories).values({
    requestId: req.id,
    action: 'SUBMITTED',
    fromStatus: 'DRAFT',
    toStatus: 'SUBMITTED',
    actorEmployeeId: actor.employeeId,
    actorType: 'USER',
    note: 'Pengajuan dikirim oleh pemohon',
  })

  await writeAuditLog(tx, {
    actorUserId: actor.userId,
    action: 'SUBMIT_REQUEST',
    entityType: 'leave_requests',
    entityId: req.id,
    oldValues: { status: 'DRAFT' },
    newValues: submittedReq,
  })

  return submittedReq
}

export async function submitRequest(requestId: string, actor: AuthContext) {
  return withTransaction(async (tx) => {
    try {
      return await executeSubmitRequest(tx, requestId, actor)
    } catch (err: any) {
      if (err?.code === '23P01') {
        throw createError({
          statusCode: 409,
          statusMessage: 'REQUEST_OVERLAP',
          message: 'Anda sudah memiliki pengajuan aktif pada rentang tanggal tersebut.',
        })
      }
      throw err
    }
  })
}

export async function cancelRequest(requestId: string, reason: string, actor: AuthContext) {
  return withTransaction(async (tx) => {
    const [req] = await tx
      .select()
      .from(schema.leaveRequests)
      .where(eq(schema.leaveRequests.id, requestId))
      .for('update')
      .limit(1)

  if (!req) {
    throw createError({ statusCode: 404, message: 'Pengajuan tidak ditemukan.' })
  }

  const isOwner = actor.employeeId === req.employeeId
  const isAdmin = actor.roles.includes('ADMIN') || actor.roles.includes('HR_APPROVER')

  if (!isOwner && !isAdmin) {
    throw createError({ statusCode: 403, message: 'Anda tidak memiliki hak untuk membatalkan pengajuan ini.' })
  }

  const [lt] = await tx
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, req.leaveTypeId))
    .limit(1)

  // Kasus 1: DRAFT
  if (req.status === 'DRAFT') {
    // Hapus lampiran fisik & database
    const atts = await tx
      .select()
      .from(schema.leaveRequestAttachments)
      .where(eq(schema.leaveRequestAttachments.requestId, req.id))

    for (const a of atts) {
      if (fs.existsSync(a.filePath)) {
        try {
          fs.unlinkSync(a.filePath)
        } catch {}
      }
    }

    await tx.delete(schema.leaveRequests).where(eq(schema.leaveRequests.id, req.id))

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'DELETE_DRAFT_REQUEST',
      entityType: 'leave_requests',
      entityId: req.id,
      oldValues: req,
    })

    return { ok: true, message: 'Draf pengajuan berhasil dihapus.' }
  }

  // Kasus 2: SUBMITTED atau IN_REVIEW
  if (req.status === 'SUBMITTED' || req.status === 'IN_REVIEW') {
    // Kembalikan kuota reserved bila memotong kuota
    if (lt?.deductsQuota) {
      const year = new Date(req.startDate).getFullYear()
      const [quota] = await tx
        .select()
        .from(schema.leaveQuotas)
        .where(
          and(
            eq(schema.leaveQuotas.employeeId, req.employeeId),
            eq(schema.leaveQuotas.leaveTypeId, req.leaveTypeId),
            eq(schema.leaveQuotas.periodYear, year)
          )
        )
        .for('update')
        .limit(1)

      if (quota) {
        const reqDays = Number(req.totalDays)
        const newReserved = Math.max(0, Number(quota.reserved) - reqDays)
        await tx
          .update(schema.leaveQuotas)
          .set({
            reserved: String(newReserved),
            updatedAt: new Date(),
          })
          .where(eq(schema.leaveQuotas.id, quota.id))

        await tx.insert(schema.leaveQuotaLedger).values({
          quotaId: quota.id,
          requestId: req.id,
          txnType: 'RELEASE',
          amount: String(reqDays),
          balanceAfter: String(Number(quota.balance) + reqDays),
          note: `Pembatalan pengajuan ${req.requestNumber}`,
          createdBy: actor.userId,
        })
      }
    }

    // Batalkan approval_tasks yang PENDING atau WAITING
    await tx
      .update(schema.approvalTasks)
      .set({
        status: 'CANCELLED',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.approvalTasks.requestId, req.id),
          or(eq(schema.approvalTasks.status, 'PENDING'), eq(schema.approvalTasks.status, 'WAITING'))
        )
      )

    // Ubah status request ke CANCELLED
    const [updatedReq] = await tx
      .update(schema.leaveRequests)
      .set({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.leaveRequests.id, req.id))
      .returning()

    await tx.insert(schema.approvalHistories).values({
      requestId: req.id,
      action: 'CANCELLED',
      fromStatus: req.status,
      toStatus: 'CANCELLED',
      actorEmployeeId: actor.employeeId,
      actorType: isAdmin ? 'ADMIN' : 'USER',
      reason,
      note: `Pengajuan dibatalkan oleh ${isAdmin ? 'Admin' : 'Pemohon'}: ${reason}`,
    })

    await writeAuditLog(tx, {
      actorUserId: actor.userId,
      action: 'CANCEL_REQUEST',
      entityType: 'leave_requests',
      entityId: req.id,
      oldValues: { status: req.status },
      newValues: updatedReq,
    })

    return { ok: true, message: 'Pengajuan berhasil dibatalkan.' }
  }

  // Kasus 3: APPROVED tapi tanggal mulai belum lewat
  if (req.status === 'APPROVED') {
    const today = new Date().toISOString().slice(0, 10)
    if (req.startDate <= today) {
      throw createError({
        statusCode: 400,
        message: 'Pengajuan yang sudah berjalan tidak dapat dibatalkan melalui sistem. Silakan hubungi HRD.',
      })
    }

    if (!isAdmin) {
      throw createError({
        statusCode: 403,
        message: 'Pengajuan yang sudah disetujui hanya dapat dibatalkan oleh Admin atau HRD.',
      })
    }

    // Kembalikan kuota used
    if (lt?.deductsQuota) {
      const year = new Date(req.startDate).getFullYear()
      const [quota] = await tx
        .select()
        .from(schema.leaveQuotas)
        .where(
          and(
            eq(schema.leaveQuotas.employeeId, req.employeeId),
            eq(schema.leaveQuotas.leaveTypeId, req.leaveTypeId),
            eq(schema.leaveQuotas.periodYear, year)
          )
        )
        .for('update')
        .limit(1)

      if (quota) {
        const reqDays = Number(req.totalDays)
        const newUsed = Math.max(0, Number(quota.used) - reqDays)
        await tx
          .update(schema.leaveQuotas)
          .set({
            used: String(newUsed),
            updatedAt: new Date(),
          })
          .where(eq(schema.leaveQuotas.id, quota.id))

        await tx.insert(schema.leaveQuotaLedger).values({
          quotaId: quota.id,
          requestId: req.id,
          txnType: 'RELEASE',
          amount: String(reqDays),
          balanceAfter: String(Number(quota.balance) + reqDays),
          note: `Pembatalan pengajuan disetujui oleh HRD (${req.requestNumber})`,
          createdBy: actor.userId,
        })
      }
    }

    const [updatedReq] = await tx
      .update(schema.leaveRequests)
      .set({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.leaveRequests.id, req.id))
      .returning()

    await tx.insert(schema.approvalHistories).values({
      requestId: req.id,
      action: 'CANCELLED',
      fromStatus: 'APPROVED',
      toStatus: 'CANCELLED',
      actorEmployeeId: actor.employeeId,
      actorType: 'ADMIN',
      reason,
      note: `Pengajuan disetujui dibatalkan oleh Admin/HRD: ${reason}`,
    })

    return { ok: true, message: 'Pengajuan yang telah disetujui berhasil dibatalkan.' }
  }

  throw createError({
    statusCode: 400,
    message: `Pengajuan dengan status ${req.status} tidak dapat dibatalkan.`,
  })
  })
}

export async function listMyRequests(employeeId: string, query: LeaveRequestQuery) {
  const db = useDatabase()

  const conditions = [eq(schema.leaveRequests.employeeId, employeeId)]
  if (query.status) {
    conditions.push(eq(schema.leaveRequests.status, query.status))
  }
  if (query.leaveTypeId) {
    conditions.push(eq(schema.leaveRequests.leaveTypeId, query.leaveTypeId))
  }

  const offset = (query.page - 1) * query.perPage

  const [countRes] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.leaveRequests)
    .where(and(...conditions))

  const total = countRes?.total ?? 0

  const items = await db
    .select({
      id: schema.leaveRequests.id,
      requestNumber: schema.leaveRequests.requestNumber,
      startDate: schema.leaveRequests.startDate,
      endDate: schema.leaveRequests.endDate,
      totalDays: schema.leaveRequests.totalDays,
      workingDays: schema.leaveRequests.workingDays,
      reason: schema.leaveRequests.reason,
      status: schema.leaveRequests.status,
      submittedAt: schema.leaveRequests.submittedAt,
      createdAt: schema.leaveRequests.createdAt,
      leaveType: {
        id: schema.leaveTypes.id,
        code: schema.leaveTypes.code,
        name: schema.leaveTypes.name,
        color: schema.leaveTypes.color,
        icon: schema.leaveTypes.icon,
      },
    })
    .from(schema.leaveRequests)
    .leftJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .where(and(...conditions))
    .orderBy(desc(schema.leaveRequests.createdAt))
    .limit(query.perPage)
    .offset(offset)

  return {
    items,
    total,
    page: query.page,
    perPage: query.perPage,
    totalPages: Math.ceil(total / query.perPage),
  }
}

export async function getRequestDetail(requestId: string, auth: AuthContext) {
  const db = useDatabase()

  const [req] = await db
    .select({
      id: schema.leaveRequests.id,
      requestNumber: schema.leaveRequests.requestNumber,
      employeeId: schema.leaveRequests.employeeId,
      leaveTypeId: schema.leaveRequests.leaveTypeId,
      startDate: schema.leaveRequests.startDate,
      endDate: schema.leaveRequests.endDate,
      startDayPart: schema.leaveRequests.startDayPart,
      endDayPart: schema.leaveRequests.endDayPart,
      totalDays: schema.leaveRequests.totalDays,
      workingDays: schema.leaveRequests.workingDays,
      reason: schema.leaveRequests.reason,
      addressDuringLeave: schema.leaveRequests.addressDuringLeave,
      contactPhone: schema.leaveRequests.contactPhone,
      delegateEmployeeId: schema.leaveRequests.delegateEmployeeId,
      status: schema.leaveRequests.status,
      submittedAt: schema.leaveRequests.submittedAt,
      finalDeadlineAt: schema.leaveRequests.finalDeadlineAt,
      decidedAt: schema.leaveRequests.decidedAt,
      decidedBy: schema.leaveRequests.decidedBy,
      decisionReason: schema.leaveRequests.decisionReason,
      cancelledAt: schema.leaveRequests.cancelledAt,
      cancelReason: schema.leaveRequests.cancelReason,
      ruleCheckPassed: schema.leaveRequests.ruleCheckPassed,
      ruleCheckResult: schema.leaveRequests.ruleCheckResult,
      createdAt: schema.leaveRequests.createdAt,
      employee: {
        id: schema.employees.id,
        nip: schema.employees.nip,
        fullName: schema.employees.fullName,
        email: schema.employees.email,
        departmentName: schema.departments.name,
        positionName: schema.positions.name,
      },
      leaveType: {
        id: schema.leaveTypes.id,
        code: schema.leaveTypes.code,
        name: schema.leaveTypes.name,
        color: schema.leaveTypes.color,
        icon: schema.leaveTypes.icon,
        requiresAttachment: schema.leaveTypes.requiresAttachment,
        deductsQuota: schema.leaveTypes.deductsQuota,
      },
      delegate: {
        id: sql<string | null>`del.id`,
        fullName: sql<string | null>`del.full_name`,
      },
    })
    .from(schema.leaveRequests)
    .leftJoin(schema.employees, eq(schema.leaveRequests.employeeId, schema.employees.id))
    .leftJoin(schema.departments, eq(schema.employees.departmentId, schema.departments.id))
    .leftJoin(schema.positions, eq(schema.employees.positionId, schema.positions.id))
    .leftJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .leftJoin(sql`employees del`, sql`del.id = ${schema.leaveRequests.delegateEmployeeId}`)
    .where(eq(schema.leaveRequests.id, requestId))
    .limit(1)

  if (!req) {
    throw createError({ statusCode: 404, message: 'Pengajuan tidak ditemukan.' })
  }

  // Cek otorisasi
  const isOwner = auth.employeeId === req.employeeId
  const canViewAll = auth.permissions.includes('request.view.all')
  const isAdmin = auth.roles.includes('ADMIN') || auth.roles.includes('HR_APPROVER')

  if (!isOwner && !canViewAll && !isAdmin) {
    // Periksa apakah user adalah approver yang ditugaskan
    const [assigned] = await db
      .select({ id: schema.approvalTaskAssignees.id })
      .from(schema.approvalTaskAssignees)
      .innerJoin(schema.approvalTasks, eq(schema.approvalTaskAssignees.taskId, schema.approvalTasks.id))
      .where(
        and(
          eq(schema.approvalTasks.requestId, requestId),
          eq(schema.approvalTaskAssignees.employeeId, auth.employeeId ?? '')
        )
      )
      .limit(1)

    if (!assigned) {
      throw createError({ statusCode: 403, message: 'Anda tidak memiliki hak untuk melihat pengajuan ini.' })
    }
  }

  // Ambil rincian hari
  const days = await db
    .select()
    .from(schema.leaveRequestDays)
    .where(eq(schema.leaveRequestDays.requestId, requestId))
    .orderBy(asc(schema.leaveRequestDays.leaveDate))

  // Ambil lampiran
  const attachments = await db
    .select({
      id: schema.leaveRequestAttachments.id,
      fileName: schema.leaveRequestAttachments.fileName,
      mimeType: schema.leaveRequestAttachments.mimeType,
      sizeBytes: schema.leaveRequestAttachments.sizeBytes,
      uploadedAt: schema.leaveRequestAttachments.uploadedAt,
    })
    .from(schema.leaveRequestAttachments)
    .where(eq(schema.leaveRequestAttachments.requestId, requestId))

  // Ambil riwayat tindakan
  const histories = await db
    .select({
      id: schema.approvalHistories.id,
      action: schema.approvalHistories.action,
      stepName: schema.approvalHistories.stepName,
      actorType: schema.approvalHistories.actorType,
      note: schema.approvalHistories.note,
      reason: schema.approvalHistories.reason,
      createdAt: schema.approvalHistories.createdAt,
      actorName: sql<string | null>`act.full_name`,
    })
    .from(schema.approvalHistories)
    .leftJoin(sql`employees act`, sql`act.id = ${schema.approvalHistories.actorEmployeeId}`)
    .where(eq(schema.approvalHistories.requestId, requestId))
    .orderBy(desc(schema.approvalHistories.createdAt))

  return {
    ...req,
    days,
    attachments,
    histories,
  }
}

export async function uploadAttachment(
  requestId: string,
  file: MultiPartData,
  actor: AuthContext
) {
  const db = useDatabase()

  const [req] = await db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, requestId))
    .limit(1)

  if (!req) {
    throw createError({ statusCode: 404, message: 'Pengajuan tidak ditemukan.' })
  }

  if (req.status !== 'DRAFT') {
    throw createError({ statusCode: 400, message: 'Lampiran hanya dapat diunggah saat pengajuan masih berstatus DRAF.' })
  }

  if (actor.employeeId !== req.employeeId && !actor.roles.includes('ADMIN')) {
    throw createError({ statusCode: 403, message: 'Anda tidak memiliki hak untuk mengunggah berkas pada pengajuan ini.' })
  }

  // Cek jumlah lampiran saat ini
  const existingAtts = await db
    .select({ id: schema.leaveRequestAttachments.id })
    .from(schema.leaveRequestAttachments)
    .where(eq(schema.leaveRequestAttachments.requestId, requestId))

  if (existingAtts.length >= 5) {
    throw createError({ statusCode: 400, message: 'Maksimal 5 berkas lampiran per pengajuan.' })
  }

  // Batas ukuran 5MB
  if (!file.data || file.data.length > 5 * 1024 * 1024) {
    throw createError({ statusCode: 400, message: 'Ukuran berkas maksimal 5 MB.' })
  }

  // Validasi magic bytes
  const mimeType = detectMimeTypeFromBytes(file.data)
  if (!mimeType) {
    throw createError({
      statusCode: 400,
      message: 'Format berkas tidak didukung atau isi berkas tidak valid. Gunakan format JPEG, PNG, atau PDF.',
    })
  }

  const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.pdf'
  const fileId = randomUUID()
  const fileName = file.filename || `lampiran_${fileId}${ext}`
  const targetDir = ensureStorageDir(requestId)
  const targetPath = path.join(targetDir, `${fileId}${ext}`)

  fs.writeFileSync(targetPath, file.data)

  const [att] = await db
    .insert(schema.leaveRequestAttachments)
    .values({
      requestId,
      fileName,
      filePath: targetPath,
      mimeType,
      sizeBytes: file.data.length,
      uploadedBy: actor.userId,
    })
    .returning()

  return att
}

export async function deleteAttachment(requestId: string, attachmentId: string, actor: AuthContext) {
  const db = useDatabase()

  const [req] = await db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, requestId))
    .limit(1)

  if (!req || req.status !== 'DRAFT') {
    throw createError({ statusCode: 400, message: 'Lampiran hanya dapat dihapus saat pengajuan masih berstatus DRAF.' })
  }

  if (actor.employeeId !== req.employeeId && !actor.roles.includes('ADMIN')) {
    throw createError({ statusCode: 403, message: 'Akses ditolak.' })
  }

  const [att] = await db
    .select()
    .from(schema.leaveRequestAttachments)
    .where(
      and(
        eq(schema.leaveRequestAttachments.id, attachmentId),
        eq(schema.leaveRequestAttachments.requestId, requestId)
      )
    )
    .limit(1)

  if (!att) {
    throw createError({ statusCode: 404, message: 'Lampiran tidak ditemukan.' })
  }

  if (fs.existsSync(att.filePath)) {
    try {
      fs.unlinkSync(att.filePath)
    } catch {}
  }

  await db
    .delete(schema.leaveRequestAttachments)
    .where(eq(schema.leaveRequestAttachments.id, attachmentId))

  return { ok: true }
}

export async function getAttachmentStream(requestId: string, attachmentId: string, auth: AuthContext) {
  const db = useDatabase()

  // Ambil request untuk otorisasi
  await getRequestDetail(requestId, auth)

  const [att] = await db
    .select()
    .from(schema.leaveRequestAttachments)
    .where(
      and(
        eq(schema.leaveRequestAttachments.id, attachmentId),
        eq(schema.leaveRequestAttachments.requestId, requestId)
      )
    )
    .limit(1)

  if (!att || !fs.existsSync(att.filePath)) {
    throw createError({ statusCode: 404, message: 'Berkas fisik tidak ditemukan.' })
  }

  return {
    stream: fs.createReadStream(att.filePath),
    fileName: att.fileName,
    mimeType: att.mimeType || 'application/octet-stream',
    size: att.sizeBytes,
  }
}
