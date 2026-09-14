<script setup lang="ts">
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const workflowId = computed(() => route.params.id as string)

useHead({
  title: 'Penyusun Alur Persetujuan · Admin',
})

const activeTab = ref<'steps' | 'simulator' | 'settings'>('steps')

// 1. Ambil data alur & tahap
const { data: res, pending, refresh } = await useFetch<{ data: { workflow: any; steps: any[] } }>(
  () => `/api/admin/workflows/${workflowId.value}`
)

const workflow = computed(() => res.value?.data?.workflow)
const steps = computed(() => res.value?.data?.steps ?? [])

// Master data pendukung
const { data: deptRes } = await useFetch<{ data: any[] }>('/api/admin/departments')
const departments = computed(() => deptRes.value?.data ?? [])

const { data: ltRes } = await useFetch<{ data: any[] }>('/api/admin/leave-types')
const leaveTypes = computed(() => ltRes.value?.data ?? [])

const { data: posRes } = await useFetch<{ data: any[] }>('/api/admin/positions')
const positions = computed(() => posRes.value?.data ?? [])

const { data: empRes } = await useFetch<{ data: any }>('/api/admin/employees', {
  query: { limit: 100 },
})
const employees = computed(() => empRes.value?.data?.items ?? empRes.value?.data ?? [])

// ==================== PENGATURAN ALUR (SETTINGS) ====================
const isSavingWf = ref(false)
const wfFormError = ref<string | null>(null)
const wfSuccess = ref(false)

const wfForm = reactive({
  name: '',
  description: '',
  priority: 50,
  leaveTypeId: '',
  departmentId: '',
  minDays: '',
  maxDays: '',
  isActive: true,
})

watch(
  workflow,
  (wf) => {
    if (wf) {
      wfForm.name = wf.name || ''
      wfForm.description = wf.description || ''
      wfForm.priority = wf.priority ?? 50
      wfForm.leaveTypeId = wf.leaveTypeId || ''
      wfForm.departmentId = wf.departmentId || ''
      wfForm.minDays = wf.minDays ?? ''
      wfForm.maxDays = wf.maxDays ?? ''
      wfForm.isActive = Boolean(wf.isActive)
    }
  },
  { immediate: true }
)

async function handleUpdateWorkflow() {
  isSavingWf.value = true
  wfFormError.value = null
  wfSuccess.value = false

  try {
    await $fetch(`/api/admin/workflows/${workflowId.value}`, {
      method: 'PATCH',
      body: {
        name: wfForm.name.trim(),
        description: wfForm.description.trim() || null,
        priority: Number(wfForm.priority) || 50,
        leaveTypeId: wfForm.leaveTypeId || null,
        departmentId: wfForm.departmentId || null,
        minDays: wfForm.minDays ? Number(wfForm.minDays) : null,
        maxDays: wfForm.maxDays ? Number(wfForm.maxDays) : null,
        isActive: wfForm.isActive,
      },
    })
    wfSuccess.value = true
    await refresh()
  } catch (err: any) {
    wfFormError.value = err?.data?.message || err?.message || 'Gagal memperbarui konfigurasi alur.'
  } finally {
    isSavingWf.value = false
  }
}

// Hapus Alur
async function handleDeleteWorkflow() {
  if (!confirm(`Hapus alur persetujuan "${workflow.value?.name}" beserta seluruh tahapnya?`)) {
    return
  }
  try {
    await $fetch(`/api/admin/workflows/${workflowId.value}`, { method: 'DELETE' })
    await router.push('/admin/alur')
  } catch (err: any) {
    alert(err?.data?.message || 'Gagal menghapus alur persetujuan.')
  }
}

// ==================== MANAJEMEN TAHAP (STEP BUILDER) ====================
const showStepModal = ref(false)
const editingStepId = ref<string | null>(null)
const isSavingStep = ref(false)
const stepFormError = ref<string | null>(null)

const stepForm = reactive({
  stepOrder: 1,
  name: '',
  approverType: 'DIRECT_MANAGER',
  approverPositionId: '',
  approverPositionLevel: 2,
  approverEmployeeId: '',
  approvalMode: 'ANY_ONE',
  quorumCount: 2,
  slaHours: 24,
  slaUsesWorkingHours: true,
  reminderEnabled: true,
  reminderIntervalMinutes: 120,
  reminderMaxCount: 3,
  escalationAction: 'NONE',
  isOptional: false,
  skipIfRequester: true,
  skipIfAlreadyApproved: true,
  allowDelegation: true,
  conditionMinDays: '',
})

function openAddStepModal() {
  editingStepId.value = null
  stepForm.stepOrder = steps.value.length + 1
  stepForm.name = `Tahap ${steps.value.length + 1}`
  stepForm.approverType = 'DIRECT_MANAGER'
  stepForm.approverPositionId = ''
  stepForm.approverPositionLevel = 2
  stepForm.approverEmployeeId = ''
  stepForm.approvalMode = 'ANY_ONE'
  stepForm.quorumCount = 2
  stepForm.slaHours = 24
  stepForm.slaUsesWorkingHours = true
  stepForm.reminderEnabled = true
  stepForm.reminderIntervalMinutes = 120
  stepForm.reminderMaxCount = 3
  stepForm.escalationAction = 'NONE'
  stepForm.isOptional = false
  stepForm.skipIfRequester = true
  stepForm.skipIfAlreadyApproved = true
  stepForm.allowDelegation = true
  stepForm.conditionMinDays = ''
  stepFormError.value = null
  showStepModal.value = true
}

function openEditStepModal(s: any) {
  editingStepId.value = s.id
  stepForm.stepOrder = s.stepOrder
  stepForm.name = s.name
  stepForm.approverType = s.approverType
  stepForm.approverPositionId = s.approverPositionId || ''
  stepForm.approverPositionLevel = s.approverPositionLevel ?? 2
  stepForm.approverEmployeeId = s.approverEmployeeId || ''
  stepForm.approvalMode = s.approvalMode
  stepForm.quorumCount = s.quorumCount ?? 2
  stepForm.slaHours = Number(s.slaHours) || 24
  stepForm.slaUsesWorkingHours = Boolean(s.slaUsesWorkingHours)
  stepForm.reminderEnabled = Boolean(s.reminderEnabled)
  stepForm.reminderIntervalMinutes = s.reminderIntervalMinutes ?? 120
  stepForm.reminderMaxCount = s.reminderMaxCount ?? 3
  stepForm.escalationAction = s.escalationAction || 'NONE'
  stepForm.isOptional = Boolean(s.isOptional)
  stepForm.skipIfRequester = Boolean(s.skipIfRequester)
  stepForm.skipIfAlreadyApproved = Boolean(s.skipIfAlreadyApproved)
  stepForm.allowDelegation = Boolean(s.allowDelegation)
  stepForm.conditionMinDays = s.conditionMinDays ?? ''
  stepFormError.value = null
  showStepModal.value = true
}

async function handleSaveStep() {
  if (!stepForm.name.trim()) {
    stepFormError.value = 'Nama tahap wajib diisi.'
    return
  }

  isSavingStep.value = true
  stepFormError.value = null

  const payload: any = {
    stepOrder: Number(stepForm.stepOrder),
    name: stepForm.name.trim(),
    approverType: stepForm.approverType,
    approvalMode: stepForm.approvalMode,
    quorumCount: stepForm.approvalMode === 'QUORUM' ? Number(stepForm.quorumCount) : null,
    slaHours: Number(stepForm.slaHours),
    slaUsesWorkingHours: stepForm.slaUsesWorkingHours,
    reminderEnabled: stepForm.reminderEnabled,
    reminderIntervalMinutes: Number(stepForm.reminderIntervalMinutes),
    reminderMaxCount: Number(stepForm.reminderMaxCount),
    escalationAction: stepForm.escalationAction,
    isOptional: stepForm.isOptional,
    skipIfRequester: stepForm.skipIfRequester,
    skipIfAlreadyApproved: stepForm.skipIfAlreadyApproved,
    allowDelegation: stepForm.allowDelegation,
    conditionMinDays: stepForm.conditionMinDays ? Number(stepForm.conditionMinDays) : null,
  }

  if (stepForm.approverType === 'POSITION') {
    payload.approverPositionId = stepForm.approverPositionId || null
  } else if (stepForm.approverType === 'POSITION_LEVEL') {
    payload.approverPositionLevel = Number(stepForm.approverPositionLevel)
  } else if (stepForm.approverType === 'SPECIFIC_EMPLOYEE') {
    payload.approverEmployeeId = stepForm.approverEmployeeId || null
  }

  try {
    if (editingStepId.value) {
      await $fetch(`/api/admin/workflows/steps/${editingStepId.value}`, {
        method: 'PATCH',
        body: payload,
      })
    } else {
      await $fetch(`/api/admin/workflows/${workflowId.value}/steps`, {
        method: 'POST',
        body: payload,
      })
    }
    showStepModal.value = false
    await refresh()
  } catch (err: any) {
    stepFormError.value = err?.data?.message || err?.message || 'Gagal menyimpan tahap persetujuan.'
  } finally {
    isSavingStep.value = false
  }
}

async function handleDeleteStep(stepId: string, stepName: string) {
  if (!confirm(`Hapus tahap "${stepName}"?`)) return
  try {
    await $fetch(`/api/admin/workflows/steps/${stepId}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.message || 'Gagal menghapus tahap.')
  }
}

function formatApproverType(type: string) {
  switch (type) {
    case 'DIRECT_MANAGER':
      return 'Atasan Langsung Pemohon'
    case 'DEPARTMENT_HEAD':
      return 'Kepala Unit / Departemen'
    case 'POSITION_LEVEL':
      return 'Jenjang Jabatan Minimal'
    case 'POSITION':
      return 'Jabatan Tertentu'
    case 'SPECIFIC_EMPLOYEE':
      return 'Pegawai Tertentu'
    case 'ROLE':
      return 'Role Pengguna'
    case 'HR_DEPARTMENT':
      return 'Departemen SDM / HR'
    default:
      return type
  }
}

// ==================== SIMULATOR LIVE ALUR ====================
const simForm = reactive({
  employeeId: '',
  leaveTypeId: '',
  totalDays: 2,
})

const isSimulating = ref(false)
const simResult = ref<any | null>(null)
const simError = ref<string | null>(null)

async function handleRunSimulation() {
  if (!simForm.employeeId) {
    simError.value = 'Pilih pegawai untuk simulasi.'
    return
  }
  if (!simForm.leaveTypeId) {
    simError.value = 'Pilih jenis izin untuk simulasi.'
    return
  }

  isSimulating.value = true
  simError.value = null
  simResult.value = null

  try {
    const res = await $fetch<{ data: any }>(`/api/admin/workflows/${workflowId.value}/preview`, {
      method: 'POST',
      body: {
        employeeId: simForm.employeeId,
        leaveTypeId: simForm.leaveTypeId,
        totalDays: Number(simForm.totalDays) || 1,
      },
    })
    simResult.value = res.data
  } catch (err: any) {
    simError.value = err?.data?.message || err?.message || 'Gagal menjalankan simulasi alur.'
  } finally {
    isSimulating.value = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-16">
    <!-- Navigasi Atas -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <NuxtLink to="/admin/alur" class="hover:text-brand-600 transition-colors flex items-center gap-1">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Daftar Alur
          </NuxtLink>
          <span>/</span>
          <span class="text-slate-700 font-mono">{{ workflow?.code || 'Detail' }}</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl flex items-center gap-2">
          {{ workflow?.name }}
          <span
            v-if="workflow"
            class="badge text-xs"
            :class="workflow.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'"
          >
            {{ workflow.isActive ? 'Aktif' : 'Nonaktif' }}
          </span>
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 sm:text-sm">
          {{ workflow?.description || 'Alur persetujuan pengajuan izin bertingkat.' }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-ghost text-xs text-rose-600 hover:bg-rose-50"
          @click="handleDeleteWorkflow"
        >
          Hapus Alur
        </button>
      </div>
    </div>

    <!-- State Memuat -->
    <div v-if="pending" class="card p-12 text-center text-slate-400 text-sm">
      <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent mb-2"></div>
      <p>Memuat rincian alur persetujuan...</p>
    </div>

    <div v-else class="space-y-5">
      <!-- Tab Navigasi Halaman -->
      <div class="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
        <button
          type="button"
          class="px-4 py-2 rounded-lg transition"
          :class="activeTab === 'steps' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = 'steps'"
        >
          Tahap Persetujuan ({{ steps.length }})
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-lg transition flex items-center gap-1.5"
          :class="activeTab === 'simulator' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = 'simulator'"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Simulator Live Alur
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-lg transition"
          :class="activeTab === 'settings' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = 'settings'"
        >
          Kriteria & Pengaturan
        </button>
      </div>

      <!-- ==================== TAB 1: STEP BUILDER ==================== -->
      <div v-if="activeTab === 'steps'" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-slate-900">Urutan Tahap Persetujuan (Steps)</h2>
            <p class="text-xs text-slate-500">
              Pengajuan akan dialirkan berurutan dari Tahap 1 hingga tahap terakhir.
            </p>
          </div>

          <button
            type="button"
            class="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
            @click="openAddStepModal"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Tambah Tahap
          </button>
        </div>

        <div v-if="steps.length === 0" class="card p-8 text-center space-y-3">
          <p class="text-sm font-semibold text-slate-700">Belum Ada Tahap</p>
          <p class="text-xs text-slate-400">
            Alur ini belum memiliki tahap persetujuan. Tambahkan minimal satu tahap agar alur dapat aktif.
          </p>
          <button
            type="button"
            class="btn-primary text-xs py-2 px-3"
            @click="openAddStepModal"
          >
            Tambah Tahap Pertama
          </button>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="s in steps"
            :key="s.id"
            class="card p-4 sm:p-5 space-y-3 hover:border-slate-300 transition"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-700 font-black text-xs flex-shrink-0 mt-0.5">
                  {{ s.stepOrder }}
                </span>
                <div class="space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-sm font-bold text-slate-900">{{ s.name }}</h3>
                    <span class="badge bg-brand-50 text-brand-700 text-[10px] font-semibold">
                      {{ formatApproverType(s.approverType) }}
                    </span>
                    <span class="badge bg-slate-100 text-slate-700 text-[10px]">
                      Mode: {{ s.approvalMode }}
                      <template v-if="s.approvalMode === 'QUORUM'">(Kuorum {{ s.quorumCount }})</template>
                    </span>
                  </div>

                  <p class="text-xs text-slate-500">
                    Batas SLA: <strong>{{ s.slaHours }} Jam</strong>
                    <span v-if="s.slaUsesWorkingHours"> (Jam Kerja)</span> ·
                    Pengingat: {{ s.reminderEnabled ? `Tiap ${s.reminderIntervalMinutes}m` : 'Mati' }}
                  </p>
                </div>
              </div>

              <!-- Aksi Step -->
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  class="btn-ghost text-xs py-1 px-2.5"
                  @click="openEditStepModal(s)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="text-xs text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded"
                  @click="handleDeleteStep(s.id, s.name)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Aturan Melewati & Toleransi -->
            <div class="pt-2 border-t border-slate-100 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
              <span :class="s.skipIfRequester ? 'text-emerald-700 font-medium' : 'text-slate-400'">
                ✓ Lewati jika pemohon adalah approver
              </span>
              <span>·</span>
              <span :class="s.skipIfAlreadyApproved ? 'text-emerald-700 font-medium' : 'text-slate-400'">
                ✓ Lewati jika sudah menyetujui tahap sebelumnya
              </span>
              <span>·</span>
              <span :class="s.allowDelegation ? 'text-indigo-700 font-medium' : 'text-slate-400'">
                ✓ Izinkan delegasi wewenang
              </span>
              <template v-if="s.isOptional">
                <span>·</span>
                <span class="badge bg-amber-50 text-amber-800 text-[10px]">Opsional</span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== TAB 2: LIVE SIMULATOR ==================== -->
      <div v-if="activeTab === 'simulator'" class="space-y-5">
        <div class="card p-5 space-y-4">
          <div>
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <svg class="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Simulator Penugasan Approver
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Uji coba konfigurasi hierarki untuk memastikan pegawai tertentu mendapatkan daftar approver yang sesuai.
            </p>
          </div>

          <div v-if="simError" class="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
            {{ simError }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label class="label text-xs">Pegawai Pemohon <span class="text-rose-500">*</span></label>
              <select v-model="simForm.employeeId" class="input text-xs">
                <option value="" disabled>-- Pilih Pegawai --</option>
                <option
                  v-for="emp in employees"
                  :key="emp.id"
                  :value="emp.id"
                >
                  {{ emp.fullName }} ({{ emp.positionName || 'Pegawai' }})
                </option>
              </select>
            </div>

            <div>
              <label class="label text-xs">Jenis Izin <span class="text-rose-500">*</span></label>
              <select v-model="simForm.leaveTypeId" class="input text-xs">
                <option value="" disabled>-- Pilih Jenis Izin --</option>
                <option
                  v-for="lt in leaveTypes"
                  :key="lt.id"
                  :value="lt.id"
                >
                  {{ lt.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="label text-xs">Durasi Izin (Hari)</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="simForm.totalDays"
                  type="number"
                  step="0.5"
                  min="0.5"
                  class="input text-xs"
                />
                <button
                  type="button"
                  class="btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2.5 font-bold flex-shrink-0"
                  :disabled="isSimulating"
                  @click="handleRunSimulation"
                >
                  <span v-if="isSimulating" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent mr-1"></span>
                  Uji Alur
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Hasil Simulasi -->
        <div v-if="simResult" class="card p-5 space-y-4 animate-in fade-in">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span class="text-xs text-slate-400">Alur yang Tercocokkan:</span>
              <h3 class="text-base font-bold text-slate-900">
                {{ simResult.matchedWorkflow.name }}
                <span class="font-mono text-xs text-brand-600 font-semibold">
                  (#{{ simResult.matchedWorkflow.code }}, Prioritas: {{ simResult.matchedWorkflow.priority }})
                </span>
              </h3>
            </div>
          </div>

          <div class="space-y-3">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Hasil Resolusi Kandidat Approver per Tahap:
            </h4>

            <div
              v-for="st in simResult.resolvedSteps"
              :key="st.stepOrder"
              class="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 text-xs"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white font-bold text-xs">
                    {{ st.stepOrder }}
                  </span>
                  <span class="font-bold text-slate-900">{{ st.stepName }}</span>
                  <span class="badge bg-white border border-slate-200 text-slate-600 text-[10px]">
                    {{ st.approverType }} · Mode: {{ st.approvalMode }}
                  </span>
                </div>

                <span class="text-slate-500 font-mono text-[11px]">SLA: {{ st.slaHours }} jam</span>
              </div>

              <!-- Kandidat Approver yang didapat -->
              <div v-if="st.candidates.length === 0" class="p-2.5 bg-rose-50 text-rose-800 rounded-lg text-xs border border-rose-200 flex items-center gap-2">
                <svg class="h-4 w-4 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Kandidat approver kosong pada hierarki pegawai ini. Jika tahap wajib, tugas akan dialihkan ke penanganan Admin.</span>
              </div>

              <div v-else class="space-y-1.5">
                <div
                  v-for="c in st.candidates"
                  :key="c.employeeId"
                  class="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200"
                >
                  <div>
                    <span class="font-bold text-slate-800">{{ c.fullName }}</span>
                    <span class="text-slate-500 ml-1.5">({{ c.positionName || 'Pegawai' }} · {{ c.departmentName || 'Divisi' }})</span>
                    <span v-if="c.isDelegate" class="badge bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] ml-2">
                      Delegasi Aktif
                    </span>
                  </div>
                  <span class="font-mono text-[11px] text-slate-400">NIP: {{ c.nip || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== TAB 3: SETTINGS ==================== -->
      <div v-if="activeTab === 'settings'" class="card p-5 space-y-4">
        <h2 class="text-sm font-bold text-slate-900">Kriteria & Konfigurasi Alur</h2>

        <div v-if="wfSuccess" class="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200">
          Konfigurasi alur berhasil disimpan!
        </div>

        <div v-if="wfFormError" class="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
          {{ wfFormError }}
        </div>

        <div class="space-y-3 text-xs max-w-xl">
          <div>
            <label class="label text-xs">Nama Alur Persetujuan</label>
            <input v-model="wfForm.name" type="text" class="input text-xs" />
          </div>

          <div>
            <label class="label text-xs">Deskripsi</label>
            <textarea v-model="wfForm.description" rows="2" class="input text-xs"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Prioritas Evaluasi</label>
              <input v-model.number="wfForm.priority" type="number" class="input text-xs" />
            </div>
            <div>
              <label class="label text-xs">Jenis Izin Terkait</label>
              <select v-model="wfForm.leaveTypeId" class="input text-xs">
                <option value="">Semua Jenis Izin</option>
                <option
                  v-for="lt in leaveTypes"
                  :key="lt.id"
                  :value="lt.id"
                >
                  {{ lt.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Departemen Terkait</label>
              <select v-model="wfForm.departmentId" class="input text-xs">
                <option value="">Semua Departemen</option>
                <option
                  v-for="dept in departments"
                  :key="dept.id"
                  :value="dept.id"
                >
                  {{ dept.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="label text-xs">Status Alur</label>
              <select v-model="wfForm.isActive" class="input text-xs">
                <option :value="true">Aktif</option>
                <option :value="false">Nonaktif</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Durasi Minimal (Hari)</label>
              <input v-model="wfForm.minDays" type="number" step="0.5" class="input text-xs" />
            </div>
            <div>
              <label class="label text-xs">Durasi Maksimal (Hari)</label>
              <input v-model="wfForm.maxDays" type="number" step="0.5" class="input text-xs" />
            </div>
          </div>

          <div class="pt-3">
            <button
              type="button"
              class="btn-primary text-xs py-2.5 px-4"
              :disabled="isSavingWf"
              @click="handleUpdateWorkflow"
            >
              <span v-if="isSavingWf" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent mr-1"></span>
              Perbarui Alur
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Tambah / Edit Tahap -->
    <div
      v-if="showStepModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div class="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900">
            {{ editingStepId ? 'Edit Tahap Persetujuan' : 'Tambah Tahap Persetujuan' }}
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 p-1"
            @click="showStepModal = false"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div v-if="stepFormError" class="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
          {{ stepFormError }}
        </div>

        <div class="space-y-3 text-xs">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="label text-xs">Urutan Tahap <span class="text-rose-500">*</span></label>
              <input v-model.number="stepForm.stepOrder" type="number" min="1" class="input text-xs" />
            </div>
            <div class="col-span-2">
              <label class="label text-xs">Nama Tahap <span class="text-rose-500">*</span></label>
              <input v-model="stepForm.name" type="text" placeholder="misal: Persetujuan Atasan Langsung" class="input text-xs" />
            </div>
          </div>

          <div>
            <label class="label text-xs">Tipe Approver <span class="text-rose-500">*</span></label>
            <select v-model="stepForm.approverType" class="input text-xs">
              <option value="DIRECT_MANAGER">DIRECT_MANAGER - Atasan Langsung Pemohon</option>
              <option value="DEPARTMENT_HEAD">DEPARTMENT_HEAD - Kepala Departemen</option>
              <option value="POSITION_LEVEL">POSITION_LEVEL - Jenjang Jabatan Tertentu</option>
              <option value="POSITION">POSITION - Jabatan Tertentu</option>
              <option value="SPECIFIC_EMPLOYEE">SPECIFIC_EMPLOYEE - Pegawai Tertentu</option>
              <option value="HR_DEPARTMENT">HR_DEPARTMENT - Departemen HR / SDM</option>
            </select>
          </div>

          <!-- Input Kondisional Sesuai Tipe Approver -->
          <div v-if="stepForm.approverType === 'POSITION'">
            <label class="label text-xs">Pilih Jabatan Tertentu <span class="text-rose-500">*</span></label>
            <select v-model="stepForm.approverPositionId" class="input text-xs">
              <option value="" disabled>-- Pilih Jabatan --</option>
              <option
                v-for="p in positions"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }} (Level {{ p.level }})
              </option>
            </select>
          </div>

          <div v-else-if="stepForm.approverType === 'POSITION_LEVEL'">
            <label class="label text-xs">Tingkat Jenjang Jabatan Minimal <span class="text-rose-500">*</span></label>
            <input v-model.number="stepForm.approverPositionLevel" type="number" min="1" max="10" class="input text-xs" />
          </div>

          <div v-else-if="stepForm.approverType === 'SPECIFIC_EMPLOYEE'">
            <label class="label text-xs">Pilih Pegawai Approver <span class="text-rose-500">*</span></label>
            <select v-model="stepForm.approverEmployeeId" class="input text-xs">
              <option value="" disabled>-- Pilih Pegawai --</option>
              <option
                v-for="emp in employees"
                :key="emp.id"
                :value="emp.id"
              >
                {{ emp.fullName }} ({{ emp.positionName || 'Pegawai' }})
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Mode Persetujuan</label>
              <select v-model="stepForm.approvalMode" class="input text-xs">
                <option value="ANY_ONE">ANY_ONE (Cukup 1 approver)</option>
                <option value="ALL">ALL (Seluruh approver)</option>
                <option value="QUORUM">QUORUM (Jumlah kuorum minimal)</option>
              </select>
            </div>
            <div v-if="stepForm.approvalMode === 'QUORUM'">
              <label class="label text-xs">Jumlah Kuorum</label>
              <input v-model.number="stepForm.quorumCount" type="number" min="1" class="input text-xs" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Batas Waktu SLA (Jam) <span class="text-rose-500">*</span></label>
              <input v-model.number="stepForm.slaHours" type="number" min="0.5" step="0.5" class="input text-xs" />
            </div>
            <div class="flex items-center pt-5">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="stepForm.slaUsesWorkingHours" type="checkbox" class="h-4 w-4 rounded text-brand-600" />
                <span class="text-slate-700">Hanya hitung jam kerja</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Interval Pengingat (Menit)</label>
              <input v-model.number="stepForm.reminderIntervalMinutes" type="number" min="5" class="input text-xs" />
            </div>
            <div>
              <label class="label text-xs">Maksimal Pengingat</label>
              <input v-model.number="stepForm.reminderMaxCount" type="number" min="1" class="input text-xs" />
            </div>
          </div>

          <!-- Opsi Logika Cerdas -->
          <div class="pt-2 border-t border-slate-100 space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="stepForm.skipIfRequester" type="checkbox" class="h-4 w-4 rounded text-brand-600" />
              <span>Lewati tahap jika pemohon izin adalah approver itu sendiri</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="stepForm.skipIfAlreadyApproved" type="checkbox" class="h-4 w-4 rounded text-brand-600" />
              <span>Lewati approver yang sudah menyetujui tahap sebelumnya</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="stepForm.allowDelegation" type="checkbox" class="h-4 w-4 rounded text-brand-600" />
              <span>Sertakan penerima delegasi wewenang aktif</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="stepForm.isOptional" type="checkbox" class="h-4 w-4 rounded text-brand-600" />
              <span>Tahap bersifat opsional (dilewati otomatis jika tidak ada approver)</span>
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            class="btn-ghost text-xs py-2 px-3.5"
            :disabled="isSavingStep"
            @click="showStepModal = false"
          >
            Batal
          </button>
          <button
            type="button"
            class="btn-primary text-xs py-2 px-4"
            :disabled="isSavingStep"
            @click="handleSaveStep"
          >
            <span v-if="isSavingStep" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent mr-1"></span>
            Simpan Tahap
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
