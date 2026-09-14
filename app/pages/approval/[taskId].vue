<script setup lang="ts">
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const taskId = computed(() => route.params.taskId as string)

const { data: res, pending, error, refresh } = await useFetch<{ data: any }>(
  () => `/api/approvals/${taskId.value}`
)

const detail = computed(() => res.value?.data)
const task = computed(() => detail.value?.task)
const req = computed(() => detail.value?.request)
const ruleChecks = computed(() => detail.value?.ruleChecks ?? [])
const approvalSteps = computed(() => detail.value?.approvalSteps ?? [])
const teamLeaves = computed(() => detail.value?.teamLeaves ?? [])
const attachments = computed(() => detail.value?.attachments ?? [])
const days = computed(() => detail.value?.days ?? [])

const { data: timelineRes, pending: timelinePending } = await useFetch<{ data: any }>(
  () => (req.value?.id ? `/api/requests/${req.value.id}/timeline` : null)
)
const timelineData = computed(() => timelineRes.value?.data)

useHead({
  title: computed(() =>
    req.value
      ? `Persetujuan #${req.value.requestNumber} - ${req.value.requester.fullName}`
      : 'Detail Persetujuan'
  ),
})

// Modal Penolakan
const showRejectModal = ref(false)
const rejectReason = ref('')
const rejectError = ref('')

// Modal Konfirmasi Persetujuan
const showApproveModal = ref(false)
const approveNote = ref('')

// State Eksekusi
const isSubmitting = ref(false)
const actionError = ref<string | null>(null)
const conflictNotice = ref<{ actorName: string; time: string } | null>(null)

// Format Waktu & Tanggal
function formatDate(d: string | null | undefined) {
  if (!d) return '-'
  return dayjs(d).format('D MMMM YYYY')
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return '-'
  return dayjs(d).format('D MMM YYYY, HH:mm')
}

// Buka modal tolak
function openRejectModal() {
  rejectReason.value = ''
  rejectError.value = ''
  actionError.value = null
  showRejectModal.value = true
}

// Buka modal setujui
function openApproveModal() {
  approveNote.value = ''
  actionError.value = null
  showApproveModal.value = true
}

// Kirim Tindakan Persetujuan / Penolakan
async function submitAction(action: 'APPROVE' | 'REJECT') {
  if (action === 'REJECT') {
    if (!rejectReason.value || rejectReason.value.trim().length < 10) {
      rejectError.value = 'Alasan penolakan wajib diisi minimal 10 karakter.'
      return
    }
  }

  isSubmitting.value = true
  actionError.value = null

  try {
    await $fetch(`/api/approvals/${taskId.value}/act`, {
      method: 'POST',
      body: {
        action,
        note: action === 'REJECT' ? rejectReason.value.trim() : approveNote.value.trim() || undefined,
      },
    })

    showRejectModal.value = false
    showApproveModal.value = false

    // Alihkan kembali ke inbox
    await router.push('/approval')
  } catch (err: any) {
    const status = err?.status || err?.statusCode
    const data = err?.data

    if (status === 409 || data?.statusMessage === 'APPROVAL_TASK_CLOSED') {
      showRejectModal.value = false
      showApproveModal.value = false
      conflictNotice.value = {
        actorName: data?.message?.includes('oleh') ? data.message : 'approver lain',
        time: 'beberapa saat lalu',
      }
      actionError.value = data?.message || 'Tugas ini telah diselesaikan oleh approver lain.'
      await refresh()
    } else {
      actionError.value = data?.message || err?.message || 'Gagal memproses persetujuan.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-28">
    <!-- Tombol Kembali -->
    <div class="flex items-center justify-between">
      <NuxtLink
        to="/approval"
        class="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Kotak Masuk
      </NuxtLink>

      <span v-if="task" class="text-xs font-mono text-slate-400">
        {{ task.stepName }} (Tahap {{ task.stepOrder }})
      </span>
    </div>

    <!-- State Error / Memuat -->
    <div v-if="pending" class="card p-12 text-center text-slate-400 text-sm">
      <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent mb-2"></div>
      <p>Memuat detail permohonan izin...</p>
    </div>

    <div v-else-if="error || !detail" class="card p-8 text-center space-y-3">
      <p class="text-sm font-semibold text-rose-600">Gagal memuat tugas persetujuan.</p>
      <p class="text-xs text-slate-500">{{ error?.message || 'Tugas tidak ditemukan' }}</p>
      <NuxtLink to="/approval" class="btn-secondary text-xs inline-block">
        Kembali ke Kotak Masuk
      </NuxtLink>
    </div>

    <div v-else class="space-y-5">
      <!-- Banner Konflik 409 Jika Sudah Diproses -->
      <div
        v-if="conflictNotice || task.status !== 'PENDING'"
        class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
      >
        <div class="flex items-start gap-3">
          <svg class="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 class="text-sm font-bold">Tugas Telah Selesai Diproses</h3>
            <p class="text-xs text-amber-800 mt-0.5">
              {{ actionError || `Status tugas saat ini: ${task.status}. Anda tidak perlu melakukan tindakan lagi.` }}
            </p>
          </div>
        </div>
      </div>

      <!-- Kartu Ringkasan Pengajuan -->
      <div class="card p-5 space-y-4">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="badge text-white font-bold"
                :style="{ backgroundColor: req.leaveType.color || '#3b82f6' }"
              >
                {{ req.leaveType.name }}
              </span>
              <span class="text-xs font-mono text-slate-400">
                #{{ req.requestNumber }}
              </span>
            </div>
            <h2 class="text-lg font-black text-slate-900 mt-2">
              {{ req.requester.fullName }}
            </h2>
            <p class="text-xs text-slate-500">
              NIP {{ req.requester.nip }} · {{ req.requester.positionName || 'Pegawai' }} · {{ req.requester.departmentName || 'Divisi' }}
            </p>
          </div>

          <div class="text-right">
            <p class="text-2xl font-black text-brand-600">
              {{ req.workingDays }} <span class="text-xs font-medium text-slate-500">Hari Kerja</span>
            </p>
            <p class="text-[11px] text-slate-400">
              Total kalender: {{ req.totalDays }} hari
            </p>
          </div>
        </div>

        <!-- Rentang Tanggal & Waktu -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
          <div>
            <p class="text-slate-400 text-[11px]">Rentang Waktu:</p>
            <p class="font-bold text-slate-800 mt-0.5">
              {{ formatDate(req.startDate) }} s.d. {{ formatDate(req.endDate) }}
            </p>
          </div>
          <div>
            <p class="text-slate-400 text-[11px]">Diajukan Pada:</p>
            <p class="font-medium text-slate-800 mt-0.5">
              {{ formatDateTime(req.submittedAt) }}
            </p>
          </div>
        </div>

        <!-- Alasan & Kontak -->
        <div class="space-y-2 text-xs">
          <div>
            <p class="font-semibold text-slate-700">Alasan Permohonan Izin:</p>
            <p class="mt-1 text-slate-600 bg-white p-3 rounded-lg border border-slate-200/80 leading-relaxed">
              {{ req.reason || 'Tidak ada alasan tertulis' }}
            </p>
          </div>

          <div v-if="req.addressDuringLeave || req.contactPhone" class="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
            <div v-if="req.addressDuringLeave">
              <span class="text-slate-400">Alamat selama izin:</span> {{ req.addressDuringLeave }}
            </div>
            <div v-if="req.contactPhone">
              <span class="text-slate-400">Kontak darurat:</span> {{ req.contactPhone }}
            </div>
          </div>
        </div>

        <!-- Lampiran Berkas -->
        <div v-if="attachments.length > 0" class="pt-3 border-t border-slate-100">
          <p class="text-xs font-semibold text-slate-700 mb-2">Dokumen / Lampiran Pendukung:</p>
          <div class="flex flex-wrap gap-2">
            <a
              v-for="att in attachments"
              :key="att.id"
              :href="att.filePath"
              target="_blank"
              class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-brand-600 hover:bg-slate-100 transition"
            >
              <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span class="truncate max-w-[200px]">{{ att.fileName }}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Hasil Evaluasi Mesin Aturan Bisnis (Task 07 Engine) -->
      <div class="card space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Evaluasi Aturan & Kebijakan
          </h3>
          <span class="text-xs text-slate-500 tabular-nums">
            {{ ruleChecks.filter((r: any) => r.passed).length }}/{{ ruleChecks.length }} Lolos
          </span>
        </div>

        <div v-if="ruleChecks.length === 0" class="text-xs text-slate-400 italic">
          Tidak ada aturan sistem spesifik yang dievaluasi untuk jenis izin ini.
        </div>

        <RuleCheckList v-else :rules="ruleChecks" />
      </div>

      <!-- Konteks Tim Saat Ini (Rekan Divisi yang Izin pada Tanggal Serupa) -->
      <div class="card space-y-3">
        <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
          <svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Konteks Rekan Satu Divisi
        </h3>

        <div v-if="teamLeaves.length === 0" class="p-3 bg-slate-50 rounded-xl text-xs text-slate-500">
          Tidak ada rekan lain dalam satu divisi yang mengambil izin pada rentang tanggal ini.
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(tl, idx) in teamLeaves"
            :key="idx"
            class="flex items-center justify-between p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900"
          >
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-amber-500"></span>
              <span class="font-bold">{{ tl.employeeName }}</span>
              <span class="text-slate-500">({{ tl.leaveTypeName }})</span>
            </div>
            <span class="font-mono text-slate-600">{{ formatDate(tl.date) }}</span>
          </div>
        </div>
      </div>

      <!-- Stepper Ringkasan Tahapan Persetujuan -->
      <ApprovalStepper
        v-if="timelineData?.steps?.length"
        :steps="timelineData.steps"
      />

      <!-- Lini Masa Perjalanan Pengajuan Lengkap -->
      <RequestTimeline
        :entries="timelineData?.timeline || []"
        :loading="timelinePending"
      />
    </div>

    <!-- Sticky Bottom Action Bar (Thumb Zone) -->
    <AppStickyActions v-if="task && task.status === 'PENDING' && !conflictNotice">
      <!-- Tombol Tolak -->
      <button
        type="button"
        class="btn-ghost flex-1 text-red-600 border-red-200 hover:bg-red-50 font-bold text-sm"
        :disabled="isSubmitting"
        @click="openRejectModal"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>Tolak</span>
      </button>

      <!-- Tombol Setujui -->
      <button
        type="button"
        class="btn-primary flex-2 font-bold text-sm"
        :disabled="isSubmitting"
        @click="openApproveModal"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <span>Setujui</span>
      </button>
    </AppStickyActions>


    <!-- Modal Konfirmasi Penolakan (Wajib Catatan >= 10 Karakter) -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs"
    >
      <div class="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-6">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-rose-600"></span>
            Tolak Pengajuan Izin
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 p-1"
            @click="showRejectModal = false"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed">
          Mohon berikan alasan penolakan yang jelas. Alasan ini akan dikirimkan kepada pemohon dan tercatat di riwayat sistem.
        </p>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Alasan Penolakan <span class="text-rose-600">* (Wajib &ge; 10 karakter)</span>
          </label>
          <textarea
            v-model="rejectReason"
            rows="4"
            class="input text-xs"
            placeholder="Contoh: Jadwal bertabrakan dengan jadwal rilis sistem divisi IT dan membutuhkan kehadiran penuh."
          ></textarea>
          <div class="flex items-center justify-between mt-1 text-[11px]">
            <span class="text-rose-600 font-medium">{{ rejectError }}</span>
            <span :class="rejectReason.length < 10 ? 'text-slate-400' : 'text-emerald-600 font-bold'">
              {{ rejectReason.length }} karakter
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button
            type="button"
            class="btn-ghost text-xs flex-1"
            :disabled="isSubmitting"
            @click="showRejectModal = false"
          >
            Batal
          </button>
          <button
            type="button"
            class="btn bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex-1 py-2.5"
            :disabled="isSubmitting || rejectReason.trim().length < 10"
            @click="submitAction('REJECT')"
          >
            <span v-if="isSubmitting" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent mr-1"></span>
            Konfirmasi Tolak
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Konfirmasi Persetujuan -->
    <div
      v-if="showApproveModal"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs"
    >
      <div class="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-6">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
            Setujui Pengajuan Izin
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 p-1"
            @click="showApproveModal = false"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed">
          Apakah Anda yakin menyetujui permohonan izin <strong>{{ req?.requester?.fullName }}</strong> selama <strong>{{ req?.workingDays }} hari kerja</strong>?
        </p>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Catatan Persetujuan (Opsional)
          </label>
          <textarea
            v-model="approveNote"
            rows="3"
            class="input text-xs"
            placeholder="Catatan tambahan untuk pemohon jika ada..."
          ></textarea>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button
            type="button"
            class="btn-ghost text-xs flex-1"
            :disabled="isSubmitting"
            @click="showApproveModal = false"
          >
            Batal
          </button>
          <button
            type="button"
            class="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex-1 py-2.5"
            :disabled="isSubmitting"
            @click="submitAction('APPROVE')"
          >
            <span v-if="isSubmitting" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent mr-1"></span>
            Ya, Setujui
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
