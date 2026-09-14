import { and, desc, eq, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { useDatabase } from '../database'
import * as schema from '../database/schema'
import type { AuthContext } from '../utils/auth'
import { evaluateRules } from './rules'
import { expandLeaveDays, summarizeDays } from '../utils/calendar'
import type {
  ruleCreateSchema,
  ruleUpdateSchema,
  policyNewVersionSchema,
  policyTestDryRunSchema,
} from '../validators/admin'
import type { z } from 'zod'

/**
 * Daftar semua kebijakan dengan ringkasan jenis izin dan jumlah aturan.
 */
export async function listPolicies() {
  const db = useDatabase()

  const rows = await db
    .select({
      id: schema.leavePolicies.id,
      leaveTypeId: schema.leavePolicies.leaveTypeId,
      leaveTypeCode: schema.leaveTypes.code,
      leaveTypeName: schema.leaveTypes.name,
      leaveTypeColor: schema.leaveTypes.color,
      name: schema.leavePolicies.name,
      version: schema.leavePolicies.version,
      effectiveFrom: schema.leavePolicies.effectiveFrom,
      effectiveTo: schema.leavePolicies.effectiveTo,
      overallDeadlineHours: schema.leavePolicies.overallDeadlineHours,
      deadlineUsesWorkingHours: schema.leavePolicies.deadlineUsesWorkingHours,
      onDeadlineAction: schema.leavePolicies.onDeadlineAction,
      autoDecisionRequiresRulePass: schema.leavePolicies.autoDecisionRequiresRulePass,
      isActive: schema.leavePolicies.isActive,
      notes: schema.leavePolicies.notes,
      updatedAt: schema.leavePolicies.updatedAt,
      rulesCount: sql<number>`count(${schema.leavePolicyRules.id}) filter (where ${schema.leavePolicyRules.isActive})`.mapWith(Number),
    })
    .from(schema.leavePolicies)
    .innerJoin(schema.leaveTypes, eq(schema.leaveTypes.id, schema.leavePolicies.leaveTypeId))
    .leftJoin(schema.leavePolicyRules, eq(schema.leavePolicyRules.policyId, schema.leavePolicies.id))
    .groupBy(schema.leavePolicies.id, schema.leaveTypes.id)
    .orderBy(schema.leaveTypes.sortOrder, desc(schema.leavePolicies.version))

  return rows
}

/**
 * Ambil kebijakan aktif beserta seluruh aturannya untuk jenis izin tertentu.
 */
export async function getPolicyByLeaveType(leaveTypeId: string) {
  const db = useDatabase()

  // Ambil data jenis izin
  const [lt] = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, leaveTypeId))
    .limit(1)

  if (!lt) {
    throw createError({ statusCode: 404, message: 'Jenis izin tidak ditemukan' })
  }

  // Ambil semua versi kebijakan untuk jenis izin ini
  const allVersions = await db
    .select({
      id: schema.leavePolicies.id,
      name: schema.leavePolicies.name,
      version: schema.leavePolicies.version,
      effectiveFrom: schema.leavePolicies.effectiveFrom,
      effectiveTo: schema.leavePolicies.effectiveTo,
      isActive: schema.leavePolicies.isActive,
    })
    .from(schema.leavePolicies)
    .where(eq(schema.leavePolicies.leaveTypeId, leaveTypeId))
    .orderBy(desc(schema.leavePolicies.version))

  // Cari kebijakan aktif saat ini
  const today = dayjs().format('YYYY-MM-DD')
  const activePolicyRow =
    allVersions.find(
      (p) =>
        p.isActive &&
        p.effectiveFrom <= today &&
        (!p.effectiveTo || p.effectiveTo >= today)
    ) ?? allVersions[0]

  if (!activePolicyRow) {
    return {
      leaveType: lt,
      policy: null,
      rules: [],
      versions: [],
    }
  }

  // Ambil detail lengkap kebijakan terpilih
  const [policy] = await db
    .select()
    .from(schema.leavePolicies)
    .where(eq(schema.leavePolicies.id, activePolicyRow.id))
    .limit(1)

  if (!policy) {
    return {
      leaveType: lt,
      policy: null,
      rules: [],
      versions: allVersions,
    }
  }

  // Ambil seluruh aturan untuk kebijakan ini
  const rules = await db
    .select()
    .from(schema.leavePolicyRules)
    .where(eq(schema.leavePolicyRules.policyId, policy.id))
    .orderBy(schema.leavePolicyRules.evaluationOrder, schema.leavePolicyRules.createdAt)

  return {
    leaveType: lt,
    policy,
    rules,
    versions: allVersions,
  }
}

/**
 * Ambil satu kebijakan berdasarkan ID beserta aturannya.
 */
export async function getPolicyById(policyId: string) {
  const db = useDatabase()

  const [policy] = await db
    .select()
    .from(schema.leavePolicies)
    .where(eq(schema.leavePolicies.id, policyId))
    .limit(1)

  if (!policy) {
    throw createError({ statusCode: 404, message: 'Kebijakan tidak ditemukan' })
  }

  const [leaveType] = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, policy.leaveTypeId))
    .limit(1)

  const rules = await db
    .select()
    .from(schema.leavePolicyRules)
    .where(eq(schema.leavePolicyRules.policyId, policy.id))
    .orderBy(schema.leavePolicyRules.evaluationOrder, schema.leavePolicyRules.createdAt)

  return {
    policy,
    leaveType,
    rules,
  }
}

/**
 * Tambah aturan baru pada kebijakan.
 */
export async function addPolicyRule(
  policyId: string,
  input: z.infer<typeof ruleCreateSchema>,
  _actor?: AuthContext
) {
  const db = useDatabase()

  const [policy] = await db
    .select()
    .from(schema.leavePolicies)
    .where(eq(schema.leavePolicies.id, policyId))
    .limit(1)

  if (!policy) {
    throw createError({ statusCode: 404, message: 'Kebijakan tidak ditemukan' })
  }

  const [inserted] = await db
    .insert(schema.leavePolicyRules)
    .values({
      policyId,
      ruleCode: input.ruleCode,
      ruleType: input.ruleType as any,
      params: input.params,
      violationAction: input.violationAction as any,
      messageTemplate: input.messageTemplate,
      evaluationOrder: input.evaluationOrder,
      isActive: input.isActive,
    })
    .returning()

  return inserted
}

/**
 * Ubah aturan kebijakan yang ada.
 */
export async function updatePolicyRule(
  ruleId: string,
  input: z.infer<typeof ruleUpdateSchema>,
  _actor?: AuthContext
) {
  const db = useDatabase()

  const [existing] = await db
    .select()
    .from(schema.leavePolicyRules)
    .where(eq(schema.leavePolicyRules.id, ruleId))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Aturan tidak ditemukan' })
  }

  // Jika violationAction diubah menjadi BLOCK_SUBMIT, periksa apakah ada pengajuan aktif yang berpotensi terdampak
  let warningMessage: string | null = null
  if (input.violationAction === 'BLOCK_SUBMIT' && existing.violationAction !== 'BLOCK_SUBMIT') {
    const runningCount = (await db.execute(sql`
      SELECT count(r.id)::int AS count
      FROM leave_requests r
      WHERE r.policy_id = ${existing.policyId}::uuid
        AND r.status IN ('SUBMITTED', 'IN_REVIEW')
    `)) as any[]

    const count = Number(runningCount[0]?.count ?? 0)
    if (count > 0) {
      warningMessage = `Perhatian: Terdapat ${count} pengajuan yang sedang berjalan pada kebijakan ini. Perubahan aturan menjadi BLOCK_SUBMIT hanya berlaku untuk pengajuan baru, pengajuan berjalan tetap memakai snapshot saat diajukan.`
    }
  }

  const payload: Partial<typeof schema.leavePolicyRules.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (input.ruleCode !== undefined) payload.ruleCode = input.ruleCode
  if (input.params !== undefined) payload.params = input.params
  if (input.violationAction !== undefined) payload.violationAction = input.violationAction as any
  if (input.messageTemplate !== undefined) payload.messageTemplate = input.messageTemplate
  if (input.evaluationOrder !== undefined) payload.evaluationOrder = input.evaluationOrder
  if (input.isActive !== undefined) payload.isActive = input.isActive

  const [updated] = await db
    .update(schema.leavePolicyRules)
    .set(payload)
    .where(eq(schema.leavePolicyRules.id, ruleId))
    .returning()

  return {
    rule: updated,
    warning: warningMessage,
  }
}

/**
 * Hapus aturan kebijakan.
 */
export async function deletePolicyRule(ruleId: string, _actor?: AuthContext) {
  const db = useDatabase()

  const [deleted] = await db
    .delete(schema.leavePolicyRules)
    .where(eq(schema.leavePolicyRules.id, ruleId))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Aturan tidak ditemukan' })
  }

  return { success: true, id: deleted.id }
}

/**
 * Buat versi baru kebijakan dengan menyalin seluruh aturan aktif.
 */
export async function createPolicyNewVersion(
  currentPolicyId: string,
  input: z.infer<typeof policyNewVersionSchema>,
  actor?: AuthContext
) {
  const db = useDatabase()

  return await db.transaction(async (tx) => {
    // 1. Ambil kebijakan saat ini
    const [current] = await tx
      .select()
      .from(schema.leavePolicies)
      .where(eq(schema.leavePolicies.id, currentPolicyId))
      .limit(1)

    if (!current) {
      throw createError({ statusCode: 404, message: 'Kebijakan dasar tidak ditemukan' })
    }

    // 2. Ambil seluruh aturan dari kebijakan saat ini
    const currentRules = await tx
      .select()
      .from(schema.leavePolicyRules)
      .where(eq(schema.leavePolicyRules.policyId, current.id))

    // 3. Tutup masa berlaku kebijakan saat ini
    // effective_to = effective_from versi baru - 1 hari
    const prevEffectiveTo = dayjs(input.effectiveFrom).subtract(1, 'day').format('YYYY-MM-DD')

    await tx
      .update(schema.leavePolicies)
      .set({
        effectiveTo: prevEffectiveTo,
        updatedAt: new Date(),
      })
      .where(eq(schema.leavePolicies.id, current.id))

    // 4. Masukkan kebijakan versi baru
    const newVersionNum = current.version + 1
    const newPolicyName = input.name || `${current.name} (v${newVersionNum})`

    let newPolicy: typeof schema.leavePolicies.$inferSelect
    try {
      const [inserted] = await tx
        .insert(schema.leavePolicies)
        .values({
          leaveTypeId: current.leaveTypeId,
          name: newPolicyName,
          version: newVersionNum,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          overallDeadlineHours: input.overallDeadlineHours ? String(input.overallDeadlineHours) : current.overallDeadlineHours,
          deadlineUsesWorkingHours: input.deadlineUsesWorkingHours ?? current.deadlineUsesWorkingHours,
          onDeadlineAction: input.onDeadlineAction ?? current.onDeadlineAction,
          autoDecisionRequiresRulePass: input.autoDecisionRequiresRulePass ?? current.autoDecisionRequiresRulePass,
          notes: input.notes ?? current.notes,
          createdBy: actor?.userId ? (actor.userId as any) : current.createdBy,
        })
        .returning()

      if (!inserted) {
        throw createError({ statusCode: 500, message: 'Gagal membuat kebijakan baru' })
      }
      newPolicy = inserted
    } catch (err: any) {
      // Tangkap kode 23P01 (exclusion constraint violation pada periode aktif)
      if (err.code === '23P01' || String(err).includes('ex_leave_policies_active_period')) {
        throw createError({
          statusCode: 400,
          message: 'Rentang tanggal berlaku bertabrakan dengan versi kebijakan aktif lainnya untuk jenis izin ini.',
        })
      }
      throw err
    }

    // 5. Salin semua aturan ke kebijakan baru
    if (currentRules.length > 0) {
      await tx.insert(schema.leavePolicyRules).values(
        currentRules.map((r) => ({
          policyId: newPolicy.id,
          ruleCode: r.ruleCode,
          ruleType: r.ruleType,
          params: r.params,
          violationAction: r.violationAction,
          messageTemplate: r.messageTemplate,
          evaluationOrder: r.evaluationOrder,
          isActive: r.isActive,
        }))
      )
    }

    return {
      policy: newPolicy,
      copiedRulesCount: currentRules.length,
    }
  })
}

/**
 * Uji aturan kebijakan secara kering (Dry Run).
 * Tidak menyimpan perubahan apa pun ke database.
 */
export async function dryRunPolicyTest(
  policyId: string,
  input: z.infer<typeof policyTestDryRunSchema>
) {
  const db = useDatabase()

  const [policy] = await db
    .select()
    .from(schema.leavePolicies)
    .where(eq(schema.leavePolicies.id, policyId))
    .limit(1)

  if (!policy) {
    throw createError({ statusCode: 404, message: 'Kebijakan tidak ditemukan' })
  }

  const [lt] = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, policy.leaveTypeId))
    .limit(1)

  if (!lt) {
    throw createError({ statusCode: 404, message: 'Jenis izin tidak ditemukan' })
  }

  // Uraikan hari pengajuan
  const days = await expandLeaveDays(
    db,
    input.startDate,
    input.endDate,
    input.startDayPart,
    input.endDayPart
  )

  const summary = summarizeDays(days, lt.countsWorkingDaysOnly)

  // Jalankan evaluasi aturan
  const ruleResult = await evaluateRules({
    tx: db as any,
    employeeId: input.employeeId,
    leaveTypeId: policy.leaveTypeId,
    policyId: policy.id,
    startDate: input.startDate,
    endDate: input.endDate,
    totalDays: summary.totalDays,
    workingDays: summary.workingDays,
    attachmentCount: input.attachmentCount,
    phase: 'SUBMIT',
  })

  return {
    policy: {
      id: policy.id,
      name: policy.name,
      version: policy.version,
    },
    leaveType: {
      code: lt.code,
      name: lt.name,
    },
    summary,
    days,
    ruleResult,
  }
}
