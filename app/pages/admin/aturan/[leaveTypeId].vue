<script setup lang="ts">
import dayjs from 'dayjs'
import { RULE_DEFINITIONS, type RuleType } from '~~/shared/rule-definitions'

const route = useRoute()
const router = useRouter()
const leaveTypeId = computed(() => String(route.params.leaveTypeId))

// Fetch policy and rules
const { data: res, pending, refresh } = await useFetch<{
  data: {
    leaveType: any
    policy: any
    rules: any[]
    versions: any[]
  }
}>(() => `/api/admin/policies/by-leave-type/${leaveTypeId.value}`)

const leaveType = computed(() => res.value?.data?.leaveType)
const policy = computed(() => res.value?.data?.policy)
const rules = computed(() => res.value?.data?.rules ?? [])
const versions = computed(() => res.value?.data?.versions ?? [])

useHead({
  title: computed(() => `Aturan ${leaveType.value?.name ?? 'Perizinan'} · Admin`),
})

// Modal states
const showRuleModal = ref(false)
const isEditingRule = ref(false)
const editingRuleId = ref<string | null>(null)
const ruleSubmitting = ref(false)
const ruleError = ref<string | null>(null)
const ruleNotice = ref<string | null>(null)

// Rule Form State
const ruleForm = reactive({
  ruleCode: '',
  ruleType: 'MAX_DAYS_PER_REQUEST' as RuleType,
  violationAction: 'BLOCK_SUBMIT',
  evaluationOrder: 100,
  isActive: true,
  messageTemplate: '',
  params: {} as Record<string, any>,
})

// Definition for currently selected rule type
const currentDef = computed(() => RULE_DEFINITIONS[ruleForm.ruleType])

// Watch ruleType change in form to populate default template and default params
function onRuleTypeChange(newType: RuleType) {
  const def = RULE_DEFINITIONS[newType]
  if (!def) return

  // Inisialisasi parameter bawaan
  const initialParams: Record<string, any> = {}
  for (const p of def.params) {
    if (p.defaultValue !== undefined) {
      initialParams[p.key] = JSON.parse(JSON.stringify(p.defaultValue))
    } else if (p.type === 'number') {
      initialParams[p.key] = 0
    } else if (p.type === 'multiselect') {
      initialParams[p.key] = []
    } else if (p.type === 'ranges') {
      initialParams[p.key] = []
    } else if (p.type === 'json') {
      initialParams[p.key] = { field: 'totalDays', op: 'lte', value: 5 }
    } else {
      initialParams[p.key] = ''
    }
  }

  ruleForm.params = initialParams
  ruleForm.messageTemplate = def.defaultMessage
}

function openAddRuleModal() {
  isEditingRule.value = false
  editingRuleId.value = null
  ruleError.value = null
  ruleNotice.value = null

  ruleForm.ruleCode = `${leaveType.value?.code ?? 'RULE'}_ATURAN_${rules.value.length + 1}`
  ruleForm.ruleType = 'MAX_DAYS_PER_REQUEST'
  ruleForm.violationAction = 'BLOCK_SUBMIT'
  ruleForm.evaluationOrder = (rules.value.length + 1) * 10
  ruleForm.isActive = true

  onRuleTypeChange('MAX_DAYS_PER_REQUEST')
  showRuleModal.value = true
}

function openEditRuleModal(rule: any) {
  isEditingRule.value = true
  editingRuleId.value = rule.id
  ruleError.value = null
  ruleNotice.value = null

  ruleForm.ruleCode = rule.ruleCode
  ruleForm.ruleType = rule.ruleType as RuleType
  ruleForm.violationAction = rule.violationAction
  ruleForm.evaluationOrder = rule.evaluationOrder
  ruleForm.isActive = rule.isActive
  ruleForm.messageTemplate = rule.messageTemplate
  ruleForm.params = JSON.parse(JSON.stringify(rule.params ?? {}))

  showRuleModal.value = true
}

async function saveRule() {
  ruleSubmitting.value = true
  ruleError.value = null
  ruleNotice.value = null

  try {
    if (!policy.value?.id) {
      throw new Error('Kebijakan untuk jenis izin ini belum aktif')
    }

    if (isEditingRule.value && editingRuleId.value) {
      const res = await $fetch<{ data: { rule: any; warning?: string } }>(
        `/api/admin/policies/rules/${editingRuleId.value}`,
        {
          method: 'PATCH',
          body: {
            ruleCode: ruleForm.ruleCode,
            params: ruleForm.params,
            violationAction: ruleForm.violationAction,
            messageTemplate: ruleForm.messageTemplate,
            evaluationOrder: ruleForm.evaluationOrder,
            isActive: ruleForm.isActive,
          },
        }
      )
      if (res.data?.warning) {
        alert(res.data.warning)
      }
    } else {
      await $fetch(`/api/admin/policies/${policy.value.id}/rules`, {
        method: 'POST',
        body: {
          ruleCode: ruleForm.ruleCode,
          ruleType: ruleForm.ruleType,
          params: ruleForm.params,
          violationAction: ruleForm.violationAction,
          messageTemplate: ruleForm.messageTemplate,
          evaluationOrder: ruleForm.evaluationOrder,
          isActive: ruleForm.isActive,
        },
      })
    }

    showRuleModal.value = false
    await refresh()
  } catch (err: any) {
    ruleError.value = err?.data?.message || err?.message || 'Gagal menyimpan aturan'
  } finally {
    ruleSubmitting.value = false
  }
}

async function toggleRuleStatus(rule: any) {
  try {
    await $fetch(`/api/admin/policies/rules/${rule.id}`, {
      method: 'PATCH',
      body: { isActive: !rule.isActive },
    })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.message || 'Gagal mengubah status aturan')
  }
}

async function deleteRule(rule: any) {
  if (!confirm(`Hapus aturan '${rule.ruleCode}' dari kebijakan ini?`)) {
    return
  }
  try {
    await $fetch(`/api/admin/policies/rules/${rule.id}`, {
      method: 'DELETE',
    })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.message || 'Gagal menghapus aturan')
  }
}

// Modal Buat Versi Baru
const showVersionModal = ref(false)
const versionSubmitting = ref(false)
const versionError = ref<string | null>(null)
const versionForm = reactive({
  name: '',
  effectiveFrom: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  overallDeadlineHours: 24,
  notes: '',
})

function openNewVersionModal() {
  versionError.value = null
  versionForm.name = `${policy.value?.name ?? 'Kebijakan'} (v${(policy.value?.version ?? 1) + 1})`
  versionForm.effectiveFrom = dayjs().add(1, 'day').format('YYYY-MM-DD')
  versionForm.overallDeadlineHours = Number(policy.value?.overallDeadlineHours ?? 24)
  versionForm.notes = ''
  showVersionModal.value = true
}

async function saveNewVersion() {
  versionSubmitting.value = true
  versionError.value = null

  try {
    await $fetch(`/api/admin/policies/${policy.value.id}/new-version`, {
      method: 'POST',
      body: {
        name: versionForm.name,
        effectiveFrom: versionForm.effectiveFrom,
        overallDeadlineHours: versionForm.overallDeadlineHours,
        notes: versionForm.notes,
      },
    })
    showVersionModal.value = false
    await refresh()
  } catch (err: any) {
    versionError.value = err?.data?.message || err?.message || 'Gagal membuat versi baru kebijakan'
  } finally {
    versionSubmitting.value = false
  }
}

// Modal Uji Aturan (Dry Run Simulator)
const showTestModal = ref(false)
const testLoading = ref(false)
const testError = ref<string | null>(null)
const testResult = ref<any | null>(null)

// Daftar pegawai untuk selector uji coba
const { data: empRes } = await useFetch<{ data: { items: any[] } }>('/api/admin/employees?limit=50')
const employees = computed(() => empRes.value?.data?.items ?? [])

const testForm = reactive({
  employeeId: '',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: dayjs().format('YYYY-MM-DD'),
  startDayPart: 'FULL_DAY',
  endDayPart: 'FULL_DAY',
  attachmentCount: 0,
})

function openTestModal() {
  testError.value = null
  testResult.value = null
  if (employees.value.length > 0 && !testForm.employeeId) {
    testForm.employeeId = employees.value[0].id
  }
  showTestModal.value = true
}

async function runDryRunTest() {
  if (!testForm.employeeId) {
    testError.value = 'Silakan pilih pegawai untuk simulasi'
    return
  }

  testLoading.value = true
  testError.value = null
  testResult.value = null

  try {
    const res = await $fetch<{ data: any }>(`/api/admin/policies/${policy.value.id}/test`, {
      method: 'POST',
      body: testForm,
    })
    testResult.value = res.data
  } catch (err: any) {
    testError.value = err?.data?.message || err?.message || 'Gagal menjalankan simulasi uji aturan'
  } finally {
    testLoading.value = false
  }
}

function insertVariable(varName: string) {
  ruleForm.messageTemplate += ` {{${varName}}}`
}
</script>

<template>
  <div class="space-y-6 pb-16">
    <!-- Header & Navigasi Breadcrumb -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <NuxtLink to="/admin" class="hover:text-brand-600 transition-colors">Dasbor Admin</NuxtLink>
          <span>/</span>
          <NuxtLink to="/admin/aturan" class="hover:text-brand-600 transition-colors">Aturan Kebijakan</NuxtLink>
          <span>/</span>
          <span class="text-slate-700 font-bold">{{ leaveType?.name ?? 'Memuat...' }}</span>
        </div>

        <div class="flex items-center gap-3">
          <span
            class="h-4 w-4 rounded-full flex-shrink-0"
            :style="{ backgroundColor: leaveType?.color || '#64748B' }"
          ></span>
          <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
            Kebijakan {{ leaveType?.name }}
          </h1>
          <span class="badge bg-slate-100 text-slate-700 font-mono text-xs uppercase">
            {{ leaveType?.code }}
          </span>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          Aturan dinamis berlaku otomatis saat pegawai mengajukan cuti/izin ini.
        </p>
      </div>

      <!-- Aksi Utama Header -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="btn-secondary text-xs sm:text-sm inline-flex items-center gap-1.5"
          @click="openTestModal"
        >
          <svg class="h-4 w-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Uji Aturan (Dry-Run)
        </button>

        <button
          type="button"
          class="btn-secondary text-xs sm:text-sm inline-flex items-center gap-1.5"
          @click="openNewVersionModal"
        >
          <svg class="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          Buat Versi Baru
        </button>

        <button
          type="button"
          class="btn-primary text-xs sm:text-sm inline-flex items-center gap-1.5"
          @click="openAddRuleModal"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Tambah Aturan
        </button>
      </div>
    </div>

    <!-- Informasi Kebijakan Aktif -->
    <div class="card p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white border border-slate-200">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-bold text-slate-900">{{ policy?.name }}</h2>
            <span class="badge bg-brand-50 text-brand-700 font-bold text-xs">Versi {{ policy?.version }}</span>
            <span v-if="policy?.isActive" class="badge bg-emerald-50 text-emerald-700 text-xs">Aktif</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Berlaku:
            <span class="font-semibold text-slate-700">{{ dayjs(policy?.effectiveFrom).format('D MMMM YYYY') }}</span>
            s.d.
            <span class="font-semibold text-slate-700">{{ policy?.effectiveTo ? dayjs(policy?.effectiveTo).format('D MMMM YYYY') : 'Sekarang' }}</span>
            · Batas Waktu: <span class="font-semibold text-slate-700">{{ Number(policy?.overallDeadlineHours) }} Jam</span>
            · Keputusan Otomatis: <span class="font-semibold text-slate-700">{{ policy?.onDeadlineAction }}</span>
          </p>
        </div>

        <div v-if="versions.length > 1" class="flex items-center gap-2">
          <span class="text-xs text-slate-500">Riwayat Versi:</span>
          <span class="text-xs font-semibold text-slate-700">{{ versions.length }} versi terbit</span>
        </div>
      </div>

      <div class="mt-3 text-[11px] text-slate-500 bg-amber-50/80 border border-amber-200/80 rounded-lg p-2.5 flex items-start gap-2">
        <svg class="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          <strong>Catatan Kebijakan:</strong> Perubahan aturan langsung berlaku pada pengajuan baru berikutnya. Pengajuan yang saat ini sedang berjalan tetap dievaluasi berdasarkan <em>policy snapshot</em> yang disimpan saat disubmit.
        </span>
      </div>
    </div>

    <!-- Tabel / Daftar Aturan -->
    <div class="card overflow-hidden shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3 sm:px-6 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-slate-900">Daftar Aturan Evaluasi ({{ rules.length }} Aturan)</h2>
          <p class="text-xs text-slate-500">Dievaluasi berurutan dari urutan terendah ke tertinggi</p>
        </div>
      </div>

      <div v-if="pending && rules.length === 0" class="p-8 text-center text-slate-400 text-sm">
        <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent mb-2"></div>
        <p>Memuat aturan kebijakan...</p>
      </div>

      <div v-else-if="rules.length === 0" class="p-12 text-center text-slate-400 text-sm">
        <svg class="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="mt-3 font-semibold text-slate-700">Belum ada aturan pada kebijakan ini</p>
        <p class="text-xs text-slate-500 mt-1">Tambahkan aturan validasi baru untuk melindungi ketentuan jenis izin ini.</p>
        <button type="button" class="btn-primary mt-4 py-2 px-4 text-xs" @click="openAddRuleModal">
          Tambah Aturan Pertama
        </button>
      </div>

      <!-- Tampilan Desktop -->
      <div v-else class="hidden md:block overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold w-12 text-center">Urutan</th>
              <th class="px-4 py-3 font-semibold">Kode & Tipe Aturan</th>
              <th class="px-4 py-3 font-semibold">Tindakan Pelanggaran</th>
              <th class="px-4 py-3 font-semibold">Parameter</th>
              <th class="px-4 py-3 font-semibold">Templat Pesan</th>
              <th class="px-4 py-3 font-semibold text-center">Status</th>
              <th class="px-4 py-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="rule in rules"
              :key="rule.id"
              class="hover:bg-slate-50/70 transition-colors"
              :class="{ 'opacity-60 bg-slate-50/50': !rule.isActive }"
            >
              <td class="px-4 py-3 text-center font-mono font-bold text-slate-500">
                {{ rule.evaluationOrder }}
              </td>

              <td class="px-4 py-3">
                <p class="font-bold text-slate-900 font-mono text-xs">{{ rule.ruleCode }}</p>
                <span class="inline-block mt-0.5 text-[11px] text-slate-500 font-medium">
                  {{ RULE_DEFINITIONS[rule.ruleType as RuleType]?.label || rule.ruleType }}
                </span>
              </td>

              <td class="px-4 py-3">
                <span
                  v-if="rule.violationAction === 'BLOCK_SUBMIT'"
                  class="badge bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold"
                >
                  BLOKIR SUBMIT
                </span>
                <span
                  v-else-if="rule.violationAction === 'AUTO_REJECT'"
                  class="badge bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold"
                >
                  TOLAK OTOMATIS
                </span>
                <span
                  v-else-if="rule.violationAction === 'REQUIRE_APPROVAL'"
                  class="badge bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold"
                >
                  WAJIB APPROVAL
                </span>
                <span
                  v-else
                  class="badge bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold"
                >
                  HANYA PERINGATAN
                </span>
              </td>

              <td class="px-4 py-3 font-mono text-[11px] text-slate-600 max-w-[220px] truncate">
                {{ JSON.stringify(rule.params) }}
              </td>

              <td class="px-4 py-3 text-[11px] text-slate-600 max-w-[280px]">
                <p class="line-clamp-2" :title="rule.messageTemplate">{{ rule.messageTemplate }}</p>
              </td>

              <td class="px-4 py-3 text-center">
                <button
                  type="button"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors"
                  :class="rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'"
                  @click="toggleRuleStatus(rule)"
                >
                  {{ rule.isActive ? 'Aktif' : 'Nonaktif' }}
                </button>
              </td>

              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    class="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Edit Aturan"
                    @click="openEditRuleModal(rule)"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded hover:bg-rose-100 text-rose-600 transition-colors"
                    title="Hapus Aturan"
                    @click="deleteRule(rule)"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tampilan Mobile (Kartu) -->
      <div v-if="rules.length > 0" class="md:hidden divide-y divide-slate-100">
        <div
          v-for="rule in rules"
          :key="rule.id"
          class="p-4 space-y-2.5"
          :class="{ 'opacity-60 bg-slate-50/50': !rule.isActive }"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                  #{{ rule.evaluationOrder }}
                </span>
                <span class="font-bold text-slate-900 font-mono text-xs">{{ rule.ruleCode }}</span>
              </div>
              <p class="text-xs font-semibold text-slate-600 mt-0.5">
                {{ RULE_DEFINITIONS[rule.ruleType as RuleType]?.label || rule.ruleType }}
              </p>
            </div>

            <span
              v-if="rule.violationAction === 'BLOCK_SUBMIT'"
              class="badge bg-rose-50 text-rose-700 text-[10px] font-bold"
            >
              BLOKIR
            </span>
            <span
              v-else-if="rule.violationAction === 'AUTO_REJECT'"
              class="badge bg-amber-50 text-amber-700 text-[10px] font-bold"
            >
              TOLAK
            </span>
            <span
              v-else-if="rule.violationAction === 'REQUIRE_APPROVAL'"
              class="badge bg-blue-50 text-blue-700 text-[10px] font-bold"
            >
              APPROVAL
            </span>
            <span
              v-else
              class="badge bg-slate-100 text-slate-700 text-[10px] font-bold"
            >
              PERINGATAN
            </span>
          </div>

          <div class="bg-slate-50 p-2.5 rounded text-xs text-slate-600 border border-slate-100 space-y-1">
            <p class="font-mono text-[11px] text-slate-700 font-semibold">{{ JSON.stringify(rule.params) }}</p>
            <p class="text-[11px] text-slate-500 italic">"{{ rule.messageTemplate }}"</p>
          </div>

          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              class="text-xs font-semibold px-2 py-1 rounded"
              :class="rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'"
              @click="toggleRuleStatus(rule)"
            >
              {{ rule.isActive ? 'Aktif' : 'Nonaktif' }}
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                @click="openEditRuleModal(rule)"
              >
                Edit
              </button>
              <button
                type="button"
                class="btn-danger py-1 px-2.5 text-xs inline-flex items-center gap-1"
                @click="deleteRule(rule)"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODAL: Tambah / Edit Aturan                                       -->
    <!-- ================================================================= -->
    <div
      v-if="showRuleModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div class="card w-full max-w-2xl bg-white shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        <div class="border-b border-slate-200 px-5 py-4 flex items-center justify-between bg-slate-50">
          <div>
            <h3 class="text-base font-black text-slate-900">
              {{ isEditingRule ? 'Ubah Aturan Kebijakan' : 'Tambah Aturan Kebijakan Baru' }}
            </h3>
            <p class="text-xs text-slate-500">
              Konfigurasi parameter validasi dinamis untuk jenis izin {{ leaveType?.name }}
            </p>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 p-1"
            @click="showRuleModal = false"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form class="p-5 space-y-4 overflow-y-auto flex-1" @submit.prevent="saveRule">
          <div v-if="ruleError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {{ ruleError }}
          </div>

          <!-- Kode Aturan & Urutan Evaluasi -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Kode Aturan (Unique Code)</label>
              <input
                v-model="ruleForm.ruleCode"
                type="text"
                required
                class="input font-mono uppercase text-xs"
                placeholder="CONTOH: CT_MAKS_HARI"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Urutan Evaluasi (Order)</label>
              <input
                v-model.number="ruleForm.evaluationOrder"
                type="number"
                min="1"
                max="999"
                required
                class="input text-xs"
              />
              <p class="text-[10px] text-slate-400 mt-0.5">Nilai lebih kecil dievaluasi terlebih dahulu (cth: 10, 20)</p>
            </div>
          </div>

          <!-- Tipe Aturan (20 Pilihan) -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Tipe Aturan (Rule Type)</label>
            <select
              v-model="ruleForm.ruleType"
              class="input text-xs"
              :disabled="isEditingRule"
              @change="onRuleTypeChange(ruleForm.ruleType)"
            >
              <optgroup label="Durasi & Frekuensi">
                <option value="MAX_DAYS_PER_REQUEST">Maksimal Hari per Pengajuan</option>
                <option value="MIN_DAYS_PER_REQUEST">Minimal Hari per Pengajuan</option>
                <option value="MAX_DAYS_PER_PERIOD">Maksimal Hari per Periode (Minggu/Bulan/Kuartal)</option>
                <option value="MAX_REQUESTS_PER_PERIOD">Maksimal Kali Pengajuan per Periode</option>
                <option value="MAX_PER_YEAR">Maksimal Hari per Tahun</option>
              </optgroup>
              <optgroup label="Jadwal & Kalender">
                <option value="NO_CONSECUTIVE_DAYS">Tidak Boleh Hari Berturutan (WFA jeda kerja)</option>
                <option value="ALLOWED_WEEKDAYS">Hari Kerja yang Diizinkan (Sel-Kam)</option>
                <option value="MIN_NOTICE_DAYS">Pemberitahuan Minimal di Muka (Notice Days)</option>
                <option value="MAX_BACKDATE_DAYS">Batas Maksimal Pengajuan Mundur (Backdate)</option>
                <option value="BLACKOUT_PERIOD">Periode Larangan Cuti (Tutup Buku)</option>
              </optgroup>
              <optgroup label="Kelayakan Pegawai">
                <option value="GENDER_RESTRICTION">Pembatasan Gender Pegawai</option>
                <option value="MIN_EMPLOYMENT_MONTHS">Masa Kerja Minimal (Bulan)</option>
                <option value="EMPLOYMENT_STATUS_ALLOWED">Status Kepegawaian yang Diizinkan</option>
                <option value="ONCE_PER_EMPLOYMENT">Hanya Sekali Selama Masa Kerja</option>
              </optgroup>
              <optgroup label="Sumber Daya & Kuota">
                <option value="QUOTA_SUFFICIENT">Kecukupan Sisa Kuota Cuti</option>
                <option value="MAX_CONCURRENT_TEAM_ON_LEAVE">Batas Rekan Satu Tim Izin Bersamaan</option>
                <option value="NO_OVERLAP_REQUEST">Cegah Tanggal Bertumpuk (Overlap)</option>
              </optgroup>
              <optgroup label="Dokumen Lampiran">
                <option value="ATTACHMENT_REQUIRED">Wajib Lampiran Dokumen</option>
                <option value="ATTACHMENT_REQUIRED_IF_DAYS_GTE">Wajib Lampiran Jika Durasi >= Ambang Batas</option>
              </optgroup>
              <optgroup label="Kustom">
                <option value="CUSTOM_EXPRESSION">Ekspresi Kustom (JSON)</option>
              </optgroup>
            </select>
            <p v-if="currentDef" class="text-xs text-brand-600 mt-1">
              {{ currentDef.description }}
            </p>
          </div>

          <!-- Tindakan Pelanggaran -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Tindakan Saat Aturan Dilanggar</label>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label
                class="flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all text-center"
                :class="ruleForm.violationAction === 'BLOCK_SUBMIT' ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-50'"
              >
                <input v-model="ruleForm.violationAction" type="radio" value="BLOCK_SUBMIT" class="sr-only" />
                <span class="text-xs">Blokir Submit</span>
                <span class="text-[10px] text-slate-500 font-normal">Cegah pengajuan</span>
              </label>

              <label
                class="flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all text-center"
                :class="ruleForm.violationAction === 'AUTO_REJECT' ? 'border-amber-500 bg-amber-50/50 text-amber-900 font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-50'"
              >
                <input v-model="ruleForm.violationAction" type="radio" value="AUTO_REJECT" class="sr-only" />
                <span class="text-xs">Tolak Otomatis</span>
                <span class="text-[10px] text-slate-500 font-normal">Sistem auto-reject</span>
              </label>

              <label
                class="flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all text-center"
                :class="ruleForm.violationAction === 'REQUIRE_APPROVAL' ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-50'"
              >
                <input v-model="ruleForm.violationAction" type="radio" value="REQUIRE_APPROVAL" class="sr-only" />
                <span class="text-xs">Wajib Approval</span>
                <span class="text-[10px] text-slate-500 font-normal">Persetujuan manual</span>
              </label>

              <label
                class="flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all text-center"
                :class="ruleForm.violationAction === 'WARN_ONLY' ? 'border-slate-500 bg-slate-100 text-slate-900 font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-50'"
              >
                <input v-model="ruleForm.violationAction" type="radio" value="WARN_ONLY" class="sr-only" />
                <span class="text-xs">Peringatan</span>
                <span class="text-[10px] text-slate-500 font-normal">Hanya info</span>
              </label>
            </div>
          </div>

          <!-- Parameter Dinamis Berdasarkan Tipe Aturan -->
          <div class="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <svg class="h-4 w-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Parameter Spesifik: {{ currentDef?.label }}
            </h4>

            <div v-if="currentDef?.params.length === 0" class="text-xs text-slate-500 italic">
              Aturan ini tidak memerlukan konfigurasi parameter tambahan.
            </div>

            <div v-else class="space-y-3">
              <div v-for="param in currentDef?.params" :key="param.key">
                <label class="block text-xs font-semibold text-slate-700 mb-1">
                  {{ param.label }}
                  <span v-if="param.required" class="text-rose-500">*</span>
                </label>

                <!-- Input Angka -->
                <input
                  v-if="param.type === 'number'"
                  v-model.number="ruleForm.params[param.key]"
                  type="number"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step || 1"
                  class="input text-xs"
                />

                <!-- Select Dropdown -->
                <select
                  v-else-if="param.type === 'select'"
                  v-model="ruleForm.params[param.key]"
                  class="input text-xs"
                >
                  <option
                    v-for="opt in param.options"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>

                <!-- Multi-select Checkboxes (misal Allowed Weekdays atau Status) -->
                <div v-else-if="param.type === 'multiselect'" class="flex flex-wrap gap-2 pt-1">
                  <label
                    v-for="opt in param.options"
                    :key="opt.value"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border cursor-pointer"
                    :class="(ruleForm.params[param.key] || []).includes(opt.value) ? 'bg-brand-50 border-brand-500 text-brand-700 font-semibold' : 'bg-white border-slate-200 text-slate-600'"
                  >
                    <input
                      type="checkbox"
                      :value="opt.value"
                      :checked="(ruleForm.params[param.key] || []).includes(opt.value)"
                      class="rounded text-brand-600"
                      @change="(e: any) => {
                        const arr = [...(ruleForm.params[param.key] || [])]
                        if (e.target.checked) {
                          arr.push(opt.value)
                        } else {
                          const idx = arr.indexOf(opt.value)
                          if (idx !== -1) arr.splice(idx, 1)
                        }
                        ruleForm.params[param.key] = arr
                      }"
                    />
                    {{ opt.label }}
                  </label>
                </div>

                <!-- Date Ranges (BLACKOUT_PERIOD) -->
                <div v-else-if="param.type === 'ranges'" class="space-y-2">
                  <div
                    v-for="(rng, rIdx) in (ruleForm.params[param.key] || [])"
                    :key="rIdx"
                    class="flex items-center gap-2"
                  >
                    <input
                      v-model="rng.from"
                      type="date"
                      class="input text-xs"
                      placeholder="Dari"
                    />
                    <span class="text-xs text-slate-400">s.d.</span>
                    <input
                      v-model="rng.to"
                      type="date"
                      class="input text-xs"
                      placeholder="Sampai"
                    />
                    <button
                      type="button"
                      class="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                      @click="ruleForm.params[param.key].splice(rIdx, 1)"
                    >
                      &times;
                    </button>
                  </div>
                  <button
                    type="button"
                    class="btn-secondary py-1 px-2.5 text-xs text-brand-600"
                    @click="ruleForm.params[param.key] = [...(ruleForm.params[param.key] || []), { from: '', to: '' }]"
                  >
                    + Tambah Rentang Larangan
                  </button>
                </div>

                <!-- JSON Editor (CUSTOM_EXPRESSION) -->
                <div v-else-if="param.type === 'json'" class="space-y-1">
                  <textarea
                    :value="typeof ruleForm.params[param.key] === 'object' ? JSON.stringify(ruleForm.params[param.key], null, 2) : ruleForm.params[param.key]"
                    rows="4"
                    class="input font-mono text-xs"
                    @input="(e: any) => {
                      try {
                        ruleForm.params[param.key] = JSON.parse(e.target.value)
                      } catch {
                        ruleForm.params[param.key] = e.target.value
                      }
                    }"
                  ></textarea>
                  <p class="text-[10px] text-slate-400">Contoh format: {"field":"totalDays","op":"lte","value":5}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Templat Pesan Pelanggaran -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-slate-700">Templat Pesan Pelanggaran</label>
              <span class="text-[10px] text-slate-400">Gunakan placeholder &#123;&#123;variabel&#125;&#125;</span>
            </div>

            <textarea
              v-model="ruleForm.messageTemplate"
              rows="3"
              required
              class="input text-xs leading-relaxed"
              placeholder="Contoh: Pengajuan {{requested_days}} hari melebihi batas {{max_days}} hari."
            ></textarea>

            <!-- Pill Variabel yang Tersedia -->
            <div v-if="currentDef?.availableVars?.length" class="mt-2">
              <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Variabel Tersedia:</p>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="v in currentDef.availableVars"
                  :key="v"
                  type="button"
                  class="px-2 py-0.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-600 rounded text-[10px] font-mono transition-colors border border-slate-200"
                  @click="insertVariable(v)"
                >
                  + &#123;&#123;{{ v }}&#125;&#125;
                </button>
              </div>
            </div>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              class="btn-secondary py-2 px-4 text-xs"
              @click="showRuleModal = false"
            >
              Batal
            </button>
            <button
              type="submit"
              class="btn-primary py-2 px-5 text-xs inline-flex items-center gap-1.5"
              :disabled="ruleSubmitting"
            >
              <span v-if="ruleSubmitting" class="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
              {{ isEditingRule ? 'Simpan Perubahan' : 'Tambahkan Aturan' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODAL: Buat Versi Baru Kebijakan                                  -->
    <!-- ================================================================= -->
    <div
      v-if="showVersionModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div class="card w-full max-w-lg bg-white shadow-2xl overflow-hidden my-6">
        <div class="border-b border-slate-200 px-5 py-4 flex items-center justify-between bg-slate-50">
          <div>
            <h3 class="text-base font-black text-slate-900">Buat Versi Baru Kebijakan</h3>
            <p class="text-xs text-slate-500">Salin seluruh aturan aktif ke versi berikutnya secara aman</p>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600 p-1" @click="showVersionModal = false">
            &times;
          </button>
        </div>

        <form class="p-5 space-y-4" @submit.prevent="saveNewVersion">
          <div v-if="versionError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {{ versionError }}
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Nama Kebijakan Baru</label>
            <input v-model="versionForm.name" type="text" required class="input text-xs" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Mulai Berlaku (Effective From)</label>
            <input v-model="versionForm.effectiveFrom" type="date" required class="input text-xs" />
            <p class="text-[10px] text-slate-400 mt-0.5">
              Kebijakan versi saat ini (v{{ policy?.version }}) akan otomatis ditutup pada 1 hari sebelumnya.
            </p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Batas Waktu Deadline (Jam)</label>
            <input v-model.number="versionForm.overallDeadlineHours" type="number" step="0.5" class="input text-xs" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Catatan Revisi</label>
            <textarea v-model="versionForm.notes" rows="2" class="input text-xs" placeholder="Alasan perubahan kebijakan..."></textarea>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button type="button" class="btn-secondary py-2 px-4 text-xs" @click="showVersionModal = false">
              Batal
            </button>
            <button type="submit" class="btn-primary py-2 px-5 text-xs inline-flex items-center gap-1.5" :disabled="versionSubmitting">
              <span v-if="versionSubmitting" class="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
              Terbitkan Versi Baru
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODAL: Uji Aturan (Dry Run Simulator)                             -->
    <!-- ================================================================= -->
    <div
      v-if="showTestModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div class="card w-full max-w-3xl bg-white shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        <div class="border-b border-slate-200 px-5 py-4 flex items-center justify-between bg-slate-50">
          <div>
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
              <h3 class="text-base font-black text-slate-900">Simulator Uji Aturan (Dry-Run)</h3>
            </div>
            <p class="text-xs text-slate-500">
              Uji coba evaluasi aturan terhadap kebijakan aktif tanpa menyimpan perubahan apa pun
            </p>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600 p-1" @click="showTestModal = false">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-4 overflow-y-auto flex-1">
          <!-- Parameter Uji -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div class="sm:col-span-3">
              <label class="block text-xs font-bold text-slate-700 mb-1">Pegawai Contoh</label>
              <select v-model="testForm.employeeId" class="input text-xs">
                <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                  {{ emp.fullName }} ({{ emp.nip }}) - {{ emp.employmentStatus }} - {{ emp.gender }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai</label>
              <input v-model="testForm.startDate" type="date" class="input text-xs" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Tanggal Selesai</label>
              <input v-model="testForm.endDate" type="date" class="input text-xs" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Jumlah Berkas Lampiran</label>
              <input v-model.number="testForm.attachmentCount" type="number" min="0" class="input text-xs" />
            </div>
          </div>

          <div class="flex items-center justify-between">
            <p class="text-[11px] text-slate-400 italic">
              * Uji coba ini murni komputasi di memori dan tidak mengubah kuota ataupun database.
            </p>
            <button
              type="button"
              class="btn-primary py-2 px-5 text-xs inline-flex items-center gap-1.5"
              :disabled="testLoading"
              @click="runDryRunTest"
            >
              <svg
                class="h-4 w-4"
                :class="{ 'animate-spin': testLoading }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Jalankan Evaluasi
            </button>
          </div>

          <div v-if="testError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {{ testError }}
          </div>

          <!-- Hasil Evaluasi Uji Coba -->
          <div v-if="testResult" class="space-y-4 pt-2 border-t border-slate-200">
            <!-- Banner Kesimpulan -->
            <div
              class="p-4 rounded-xl border flex items-center justify-between"
              :class="testResult.ruleResult.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'"
            >
              <div>
                <p class="text-xs font-bold uppercase tracking-wider">
                  {{ testResult.ruleResult.passed ? 'Seluruh Aturan Lolos' : 'Terdapat Pelanggaran Aturan' }}
                </p>
                <p class="text-sm font-semibold mt-0.5">
                  Durasi: {{ testResult.summary.totalDays }} hari ({{ testResult.summary.workingDays }} hari kerja)
                </p>
              </div>

              <span
                class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                :class="testResult.ruleResult.passed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'"
              >
                {{ testResult.ruleResult.passed ? 'LOLOS' : 'TIDAK LOLOS' }}
              </span>
            </div>

            <!-- Pesan Blokir / Penolakan -->
            <div v-if="testResult.ruleResult.blockingMessages.length > 0" class="p-3 bg-rose-100/70 border border-rose-300 rounded-lg text-xs space-y-1">
              <p class="font-bold text-rose-900">Pesan Pemblokir Pengajuan (BLOCK_SUBMIT):</p>
              <ul class="list-disc list-inside text-rose-800 space-y-0.5">
                <li v-for="(msg, mIdx) in testResult.ruleResult.blockingMessages" :key="mIdx">{{ msg }}</li>
              </ul>
            </div>

            <div v-if="testResult.ruleResult.autoRejectMessages.length > 0" class="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-xs space-y-1">
              <p class="font-bold text-amber-900">Pesan Penolakan Otomatis (AUTO_REJECT):</p>
              <ul class="list-disc list-inside text-amber-800 space-y-0.5">
                <li v-for="(msg, mIdx) in testResult.ruleResult.autoRejectMessages" :key="mIdx">{{ msg }}</li>
              </ul>
            </div>

            <!-- Matriks Detail Evaluasi Seluruh Aturan -->
            <div class="border border-slate-200 rounded-xl overflow-hidden">
              <div class="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200">
                Matriks Evaluasi per Aturan
              </div>
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-100/60 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th class="px-3 py-2 w-10 text-center">Status</th>
                    <th class="px-3 py-2">Aturan</th>
                    <th class="px-3 py-2">Aksi</th>
                    <th class="px-3 py-2">Hasil / Pesan Evaluasi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(det, dIdx) in testResult.ruleResult.details"
                    :key="dIdx"
                    :class="det.passed ? 'bg-white' : 'bg-rose-50/30'"
                  >
                    <td class="px-3 py-2 text-center">
                      <span
                        class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
                        :class="det.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'"
                      >
                        {{ det.passed ? '✓' : '✗' }}
                      </span>
                    </td>
                    <td class="px-3 py-2">
                      <p class="font-mono font-bold text-slate-800 text-[11px]">{{ det.ruleCode }}</p>
                      <p class="text-[10px] text-slate-400">{{ det.ruleType }}</p>
                    </td>
                    <td class="px-3 py-2">
                      <span v-if="det.violationAction" class="text-[10px] font-semibold text-slate-600">
                        {{ det.violationAction }}
                      </span>
                      <span v-else class="text-[10px] text-slate-400">-</span>
                    </td>
                    <td class="px-3 py-2">
                      <p v-if="det.passed" class="text-emerald-600 font-semibold text-[11px]">Memenuhi syarat</p>
                      <p v-else class="text-rose-700 font-medium text-[11px]">{{ det.message }}</p>
                      <p class="text-[9px] font-mono text-slate-400 mt-0.5 truncate">
                        {{ JSON.stringify(det.context) }}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
