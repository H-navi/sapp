<script setup lang="ts">
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const requestId = route.params.id as string

// 1. Fetch Detail Pengajuan
const { data: requestRes, pending: reqPending, error: reqError, refresh: refreshRequest } = await useFetch<{ data: any }>(
  `/api/requests/${requestId}`
)

// 2. Fetch Timeline & Stepper
const { data: timelineRes, pending: timelinePending, refresh: refreshTimeline } = await useFetch<{ data: any }>(
  `/api/requests/${requestId}/timeline`
)

// 3. Fetch Active Employees for Reassign dropdown
const { data: employeesRes } = await useFetch<{ data: any[] }>(
  '/api/admin/employees',
  { query: { is_active: 'true', limit: 100 } }
)

const req = computed(() => requestRes.value?.data)
const timelineData = computed(() => timelineRes.value?.data)
const employees = computed(() => employeesRes.value?.data || [])

useHead({
  title: computed(() => (req.value ? `Detail Pengajuan #${req.value.requestNumber} · Admin` : 'Detail Pengajuan')),
})

// Cek apakah pengajuan milik admin sendiri
const isSelfRequest = computed(() => {
  return user.value?.employeeId && req.value?.employee?.id === user.value.employeeId
})

// Modal Intervensi State
const showInterventionModal = ref(false)
const interventionAction = ref<'REASSIGN' | 'FORCE_APPROVE_STEP' | 'FORCE_DECISION' | 'EXTEND_DEADLINE' | 'REOPEN'>('FORCE_APPROVE_STEP')
const interventionReason = ref('')
const selectedApproverId = ref('')
const forceDecision = ref<'APPROVED' | 'REJECTED'>('APPROVED')
const extendHours = ref(24)
const isSubmittingIntervention = ref(false)
const interventionError = ref<string | null>(null)
const interventionSuccess = ref<string | null>(null)

function openInterventionModal(action: 'REASSIGN' | 'FORCE_APPROVE_STEP' | 'FORCE_DECISION' | 'EXTEND_DEADLINE' | 'REOPEN') {
  interventionAction.value = action
  interventionReason.value = ''
  interventionError.value = null
  selectedApproverId.value = ''
  forceDecision.value = 'APPROVED'
  extendHours.value = 24
  showInterventionModal.value = true
}

async function submitIntervention() {
  if (!interventionReason.value || interventionReason.value.trim().length < 5) {
    interventionError.value = 'Alasan intervensi wajib diisi minimal 5 karakter.'
    return
  }

  if (interventionAction.value === 'REASSIGN' && !selectedApproverId.value) {
    interventionError.value = 'Approver baru wajib dipilih.'
    return
  }

  isSubmittingIntervention.value = true
  interventionError.value = null
  interventionSuccess.value = null

  try {
    const res = await $fetch<{ data: any }>(`/api/admin/requests/${requestId}/intervention`, {
      method: 'POST',
      body: {
        action: interventionAction.value,
        reason: interventionReason.value.trim(),
        newApproverEmployeeId: selectedApproverId.value || undefined,
        decision: forceDecision.value,
        hours: Number(extendHours.value) || 24,
      },
    })

    interventionSuccess.value = 'Tindakan intervensi berhasil dieksekusi dan tercatat di riwayat.'
    showInterventionModal.value = false

    await Promise.all([refreshRequest(), refreshTimeline()])
  } catch (err: any) {
    interventionError.value = err?.data?.message || err?.statusMessage || 'Gagal memproses tindakan intervensi.'
  } finally {
    isSubmittingIntervention.value = false
  }
}

function formatDate(d?: string | null) {
  if (!d) return '-'
  return dayjs(d).format('D MMMM YYYY')
}

function formatDateTime(d?: string | null) {
  if (!d) return '-'
  return dayjs(d).format('D MMM YYYY, HH:mm [WIB]')
}
</script>


<template>
  <div class="space-y-6 max-w-4xl mx-auto pb-16">
    <!-- Header Nav -->
    <div class="flex items-center justify-between">
      <NuxtLink
        to="/admin/pengajuan"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl transition"
      >
        &larr; Kembali ke Daftar Pengawasan
      </NuxtLink>

      <span class="text-xs font-mono px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
        Admin Mode
      </span>
    </div>

    <!-- Error State -->
    <div v-if="reqError" class="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
      <h3 class="font-bold text-rose-800 text-base">Gagal Memuat Pengajuan</h3>
      <p class="text-xs text-rose-600">
        {{ (reqError as any)?.data?.message || reqError?.statusMessage || 'Pengajuan tidak ditemukan.' }}
      </p>
    </div>

    <div v-else-if="req" class="space-y-6">
      <!-- Success / Error Notice -->
      <div v-if="interventionSuccess" class="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center justify-between">
        <span>✓ {{ interventionSuccess }}</span>
        <button type="button" class="text-emerald-600 hover:text-emerald-900" @click="interventionSuccess = null">✕</button>
      </div>

      <!-- Self Request Warning Banner -->
      <div v-if="isSelfRequest" class="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
        <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <span class="font-bold">Perhatian: Pengajuan Milik Pribadi</span>
          <p class="mt-0.5 text-amber-800">
            Anda login sebagai pemohon pengajuan ini. Administrator dilarang mengintervensi alur persetujuan pengajuannya sendiri untuk mencegah konflik kepentingan.
          </p>
        </div>
      </div>

      <!-- Kartu Ringkasan Pengajuan -->
      <div class="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div class="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <StatusBadge :status="req.status" />
              <span class="text-xs font-mono text-slate-500">
                #{{ req.requestNumber }}
              </span>
            </div>


            <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2 pt-1.5">
              <span
                class="w-3.5 h-3.5 rounded-full shrink-0"
                :style="{ backgroundColor: req.leaveType?.color || '#3b82f6' }"
              ></span>
              {{ req.leaveType?.name }}
            </h2>

            <p class="text-xs text-slate-600 mt-1">
              Pemohon: <strong class="text-slate-900">{{ req.employee?.fullName }}</strong> (NIP: {{ req.employee?.nip }}) · Divisi: {{ req.employee?.departmentName }}
            </p>
          </div>

          <div class="text-right">
            <span class="text-3xl font-black text-blue-600">{{ req.workingDays }}</span>
            <span class="text-xs text-slate-500 block">hari kerja</span>
            <span class="text-[11px] text-slate-400">Total kalender: {{ req.totalDays }} hari</span>
          </div>
        </div>

        <!-- Rentang & Info -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
          <div>
            <span class="text-slate-400 text-[11px] block">Rentang Tanggal:</span>
            <span class="font-bold text-slate-800">{{ formatDate(req.startDate) }} – {{ formatDate(req.endDate) }}</span>
          </div>
          <div>
            <span class="text-slate-400 text-[11px] block">Tanggal Pengajuan:</span>
            <span class="font-semibold text-slate-800">{{ formatDateTime(req.submittedAt) }}</span>
          </div>
          <div>
            <span class="text-slate-400 text-[11px] block">Batas SLA:</span>
            <span class="font-semibold" :class="req.finalDeadlineAt ? 'text-amber-700' : 'text-slate-500'">
              {{ req.finalDeadlineAt ? formatDateTime(req.finalDeadlineAt) : '-' }}
            </span>
          </div>
        </div>

        <!-- Alasan -->
        <div class="space-y-1">
          <span class="text-xs font-bold text-slate-700 uppercase tracking-wide">Alasan Permohonan Izin:</span>
          <p class="text-xs text-slate-800 bg-slate-50/70 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
            {{ req.reason }}
          </p>
        </div>

        <!-- Toolbar Tombol Intervensi Admin -->
        <div v-if="!isSelfRequest" class="pt-3 border-t border-slate-100">
          <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Tindakan Intervensi Alur Administrator
          </h4>

          <div class="flex flex-wrap gap-2">
            <!-- Jika Masih IN_REVIEW / SUBMITTED -->
            <template v-if="req.status === 'SUBMITTED' || req.status === 'IN_REVIEW'">
              <button
                type="button"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition active:scale-95"
                @click="openInterventionModal('REASSIGN')"
              >
                Alihkan Approver
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition active:scale-95"
                @click="openInterventionModal('FORCE_APPROVE_STEP')"
              >
                Paksa Setujui Tahap
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition active:scale-95"
                @click="openInterventionModal('EXTEND_DEADLINE')"
              >
                Perpanjang Batas Waktu
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition active:scale-95"
                @click="forceDecision = 'APPROVED'; openInterventionModal('FORCE_DECISION')"
              >
                Paksa Setujui Final
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition active:scale-95"
                @click="forceDecision = 'REJECTED'; openInterventionModal('FORCE_DECISION')"
              >
                Paksa Tolak Final
              </button>
            </template>

            <!-- Jika Sudah Ditolak / Kedaluwarsa -->
            <template v-else-if="req.status === 'REJECTED' || req.status === 'EXPIRED'">
              <button
                type="button"
                class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition active:scale-95 shadow-xs"
                @click="openInterventionModal('REOPEN')"
              >
                Buka Kembali Pengajuan (Reopen)
              </button>
            </template>

            <div v-else class="text-xs text-slate-400 italic">
              Pengajuan berstatus {{ req.status }}, tidak memerlukan intervensi alur.
            </div>
          </div>
        </div>
      </div>

      <!-- Stepper Ringkasan Tahap -->
      <ApprovalStepper
        v-if="timelineData?.steps?.length"
        :steps="timelineData.steps"
      />

      <!-- Lini Masa Perjalanan Lengkap -->
      <RequestTimeline
        :entries="timelineData?.timeline || []"
        :loading="timelinePending"
      />
    </div>

    <!-- MODAL INTERVENSI ALUR ADMINISTRATOR -->
    <Teleport to="body">
      <div
        v-if="showInterventionModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      >
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 class="font-bold text-slate-900 text-base flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Intervensi Alur: {{
                interventionAction === 'REASSIGN' ? 'Alihkan Approver' :
                interventionAction === 'FORCE_APPROVE_STEP' ? 'Paksa Setujui Tahap Aktif' :
                interventionAction === 'FORCE_DECISION' ? (forceDecision === 'APPROVED' ? 'Paksa Setujui Final' : 'Paksa Tolak Final') :
                interventionAction === 'EXTEND_DEADLINE' ? 'Perpanjang Batas Waktu SLA' :
                'Buka Kembali Pengajuan'
              }}
            </h3>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 text-sm p-1"
              @click="showInterventionModal = false"
            >
              ✕
            </button>
          </div>

          <!-- Deskripsi Tindakan -->
          <p class="text-xs text-slate-600 leading-relaxed">
            Setiap tindakan intervensi wajib menyertakan alasan yang sah, akan dicatat sebagai <code>ADMIN_OVERRIDE</code> di jejak audit, dan mengirimkan notifikasi ke pihak terkait.
          </p>

          <!-- Input Khusus Sesuai Tindakan -->
          <!-- 1. Reassign Approver -->
          <div v-if="interventionAction === 'REASSIGN'" class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-700">Pilih Approver Baru <span class="text-rose-600">*</span></label>
            <select
              v-model="selectedApproverId"
              class="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Pilih Pegawai Pengganti --</option>
              <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                {{ emp.fullName }} ({{ emp.nip }}) - {{ emp.departmentName }}
              </option>
            </select>
          </div>

          <!-- 2. Extend Deadline Hours -->
          <div v-if="interventionAction === 'EXTEND_DEADLINE'" class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-700">Tambahan Jam Kerja SLA <span class="text-rose-600">*</span></label>
            <input
              v-model="extendHours"
              type="number"
              min="1"
              max="168"
              class="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p class="text-[11px] text-slate-400">Jumlah jam kerja yang akan ditambahkan ke batas waktu saat ini.</p>
          </div>

          <!-- Input Alasan Wajib (Mandatory) -->
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-700">
              Alasan Intervensi Administratif <span class="text-rose-600">* (Wajib &ge; 5 karakter)</span>
            </label>
            <textarea
              v-model="interventionReason"
              rows="3"
              placeholder="Contoh: Approver tahap ini sedang dinas luar kota tanpa akses sistem; dialihkan atas instruksi direksi..."
              class="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            ></textarea>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-rose-600 font-medium">{{ interventionError }}</span>
              <span :class="interventionReason.length < 5 ? 'text-slate-400' : 'text-emerald-600 font-bold'">
                {{ interventionReason.length }} karakter
              </span>
            </div>
          </div>

          <!-- Tombol Aksi Modal -->
          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition"
              :disabled="isSubmittingIntervention"
              @click="showInterventionModal = false"
            >
              Batal
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs disabled:opacity-50"
              :disabled="isSubmittingIntervention || interventionReason.trim().length < 5"
              @click="submitIntervention"
            >
              {{ isSubmittingIntervention ? 'Memproses...' : 'Konfirmasi Intervensi' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
