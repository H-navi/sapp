<script setup lang="ts">
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const requestId = route.params.id as string

const { data: requestData, pending, error, refresh } = await useFetch<{ data: any }>(
  `/api/requests/${requestId}`
)

const { data: timelineRes, pending: timelinePending, refresh: refreshTimeline } = await useFetch<{ data: any }>(
  `/api/requests/${requestId}/timeline`
)

const req = computed(() => requestData.value?.data)
const timelineData = computed(() => timelineRes.value?.data)

useHead({
  title: computed(() => (req.value ? `Pengajuan ${req.value.requestNumber}` : 'Detail Pengajuan')),
})

function formatDateRange(start: string, end: string) {
  const s = dayjs(start).format('DD MMMM YYYY')
  const e = dayjs(end).format('DD MMMM YYYY')
  if (s === e) return s
  return `${s} – ${e}`
}


// Action Submit Draft
const submitting = ref(false)
const actionError = ref('')

async function submitDraft() {
  actionError.value = ''
  submitting.value = true
  try {
    await $fetch(`/api/requests/${requestId}/submit`, { method: 'POST' })
    await Promise.all([refresh(), refreshTimeline()])
  } catch (err: any) {
    actionError.value = err?.data?.message || err?.statusMessage || 'Gagal mengirim pengajuan.'
  } finally {
    submitting.value = false
  }
}

// Action Cancel Request
const cancelModalOpen = ref(false)
const cancelReason = ref('')
const cancelling = ref(false)

function openCancelModal() {
  cancelReason.value = ''
  actionError.value = ''
  cancelModalOpen.value = true
}

async function handleConfirmCancel() {
  if (cancelReason.value.trim().length < 5) {
    actionError.value = 'Alasan pembatalan minimal 5 karakter.'
    return
  }

  cancelling.value = true
  actionError.value = ''
  try {
    const res = await $fetch<{ data: any }>(`/api/requests/${requestId}/cancel`, {
      method: 'POST',
      body: { reason: cancelReason.value },
    })

    cancelModalOpen.value = false

    if (req.value.status === 'DRAFT') {
      // Draf dihapus, kembali ke index
      await router.push('/pengajuan')
    } else {
      await Promise.all([refresh(), refreshTimeline()])
    }
  } catch (err: any) {
    actionError.value = err?.data?.message || err?.statusMessage || 'Gagal membatalkan pengajuan.'
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-2xl mx-auto pb-12">
    <AppPageHeader
      :title="req ? req.requestNumber : 'Detail Pengajuan'"
      description="Rincian lengkap dan status pemrosesan permohonan izin."
    >
      <template #actions>
        <NuxtLink
          to="/pengajuan"
          class="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 bg-white"
        >
          &larr; Kembali ke Daftar
        </NuxtLink>
      </template>
    </AppPageHeader>

    <!-- Error State -->
    <div v-if="error" class="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
      <h3 class="font-bold text-red-800 text-base">Pengajuan Tidak Ditemukan</h3>
      <p class="text-xs text-red-600">
        {{ (error as any)?.data?.message || error?.statusMessage || 'Data permohonan izin tidak ditemukan atau Anda tidak memiliki akses.' }}
      </p>
    </div>

    <!-- Content Detail -->
    <div v-else-if="req" class="space-y-4">
      <!-- Error Feedback Bar -->
      <div v-if="actionError" class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
        {{ actionError }}
      </div>

      <!-- KARTU STATUS UTAMA -->
      <div class="card space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1.5 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <StatusBadge :status="req.status" />
              <span class="text-xs font-mono text-slate-500">
                #{{ req.requestNumber }}
              </span>
            </div>

            <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 pt-0.5">
              <LeaveTypeChip :name="req.leaveType?.name" :color="req.leaveType?.color" />
            </h2>

            <p class="text-xs text-slate-500">
              Pemohon: <span class="font-semibold text-slate-700">{{ req.employee?.fullName }}</span> ({{ req.employee?.departmentName }})
            </p>
          </div>

          <div class="text-right shrink-0">
            <span class="text-2xl font-black text-blue-600 tabular-nums">{{ req.totalDays }}</span>
            <span class="text-xs text-slate-500 block">total hari</span>
          </div>
        </div>

        <div class="p-3 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-100">
          <div class="flex items-center justify-between text-slate-700">
            <span class="text-slate-500">Rentang Tanggal:</span>
            <span class="font-bold">{{ formatDateRange(req.startDate, req.endDate) }}</span>
          </div>
          <div class="flex items-center justify-between text-slate-700">
            <span class="text-slate-500">Hari Kerja Efektif:</span>
            <span class="font-semibold">{{ req.workingDays }} hari</span>
          </div>
          <div v-if="req.submittedAt" class="flex items-center justify-between text-slate-700">
            <span class="text-slate-500">Tanggal Diajukan:</span>
            <span>{{ dayjs(req.submittedAt).format('DD MMM YYYY, HH:mm') }} WIB</span>
          </div>
          <div v-if="req.finalDeadlineAt" class="flex items-center justify-between text-slate-700">
            <span class="text-slate-500">Batas Waktu (SLA):</span>
            <span class="font-semibold text-amber-700">{{ dayjs(req.finalDeadlineAt).format('DD MMM YYYY, HH:mm') }} WIB</span>
          </div>
        </div>

        <!-- Alasan Pengajuan -->
        <div class="space-y-1">
          <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wide">Alasan Pengajuan:</h4>
          <p class="text-sm text-slate-800 bg-slate-50/70 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
            {{ req.reason }}
          </p>
        </div>

        <!-- Info Tambahan -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 pt-1">
          <div v-if="req.delegate?.fullName">
            <span class="font-semibold text-slate-700 block">Pelimpahan Tugas:</span>
            <span>{{ req.delegate.fullName }}</span>
          </div>
          <div v-if="req.contactPhone">
            <span class="font-semibold text-slate-700 block">No. Kontak Darurat:</span>
            <span>{{ req.contactPhone }}</span>
          </div>
          <div v-if="req.addressDuringLeave" class="sm:col-span-2">
            <span class="font-semibold text-slate-700 block">Alamat Selama Izin:</span>
            <span>{{ req.addressDuringLeave }}</span>
          </div>
        </div>
      </div>

      <!-- TABEL RINCIAN HARI PER TANGGAL (Mobile-Friendly List) -->
      <div v-if="req.days?.length" class="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <h3 class="font-bold text-slate-900 text-sm flex items-center justify-between">
          <span>Rincian Kalender Izin</span>
          <span class="text-xs text-slate-500 font-normal">({{ req.days.length }} hari)</span>
        </h3>

        <div class="divide-y divide-slate-100">
          <div
            v-for="d in req.days"
            :key="d.id"
            class="py-2.5 flex items-center justify-between text-xs"
          >
            <div class="space-y-0.5">
              <span class="font-semibold text-slate-800">
                {{ dayjs(d.leaveDate).format('dddd, DD MMMM YYYY') }}
              </span>
              <span v-if="d.dayPart !== 'FULL_DAY'" class="text-slate-500 block text-[11px]">
                Porsi: {{ d.dayPart === 'MORNING' ? 'Pagi (0.5 hari)' : 'Siang (0.5 hari)' }}
              </span>
            </div>

            <div>
              <span
                v-if="d.isWorkingDay"
                class="px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                Hari Kerja ({{ d.dayValue }})
              </span>
              <span
                v-else-if="d.isHoliday"
                class="px-2 py-0.5 rounded-full font-semibold bg-red-50 text-red-700 border border-red-200"
              >
                Hari Libur
              </span>
              <span
                v-else
                class="px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-200"
              >
                Akhir Pekan
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- BERKAS LAMPIRAN -->
      <div v-if="req.attachments?.length" class="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <h3 class="font-bold text-slate-900 text-sm">
          Lampiran Berkas ({{ req.attachments.length }})
        </h3>

        <div class="space-y-2">
          <a
            v-for="att in req.attachments"
            :key="att.id"
            :href="`/api/requests/${req.id}/attachments/${att.id}`"
            target="_blank"
            class="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 transition text-xs group"
          >
            <div class="flex items-center gap-2.5 truncate">
              <svg class="w-5 h-5 text-slate-400 group-hover:text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span class="font-semibold text-slate-800 truncate">{{ att.fileName }}</span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span class="text-slate-400 text-[11px]">{{ (att.sizeBytes / 1024).toFixed(0) }} KB</span>
              <span class="text-blue-600 font-bold group-hover:underline">Buka &rarr;</span>
            </div>
          </a>
        </div>
      </div>

      <!-- RINGKASAN TAHAPAN (STEPPER) -->
      <ApprovalStepper
        v-if="timelineData?.steps?.length"
        :steps="timelineData.steps"
      />

      <!-- LINI MASA RIWAYAT PERSETUJUAN (TIMELINE) -->
      <RequestTimeline
        :entries="timelineData?.timeline || []"
        :loading="timelinePending"
      />

      <!-- TOMBOL AKSI BAWAH (SESUAI STATUS) -->
      <AppStickyActions v-if="req.status === 'DRAFT' || req.status === 'SUBMITTED' || req.status === 'IN_REVIEW'">
        <!-- Kasus DRAFT -->
        <template v-if="req.status === 'DRAFT'">
          <button
            type="button"
            class="btn-ghost flex-1 text-red-600 border-red-200 hover:bg-red-50"
            :disabled="cancelling || submitting"
            @click="openCancelModal"
          >
            Hapus Draf
          </button>

          <button
            type="button"
            class="btn-primary flex-1"
            :disabled="cancelling || submitting"
            @click="submitDraft"
          >
            {{ submitting ? 'Mengirim...' : 'Kirim Sekarang' }}
          </button>
        </template>

        <!-- Kasus SUBMITTED / IN_REVIEW -->
        <template v-else-if="req.status === 'SUBMITTED' || req.status === 'IN_REVIEW'">
          <button
            type="button"
            class="btn-ghost w-full text-red-600 border-red-200 hover:bg-red-50"
            :disabled="cancelling"
            @click="openCancelModal"
          >
            Batalkan Pengajuan
          </button>
        </template>
      </AppStickyActions>
    </div>


    <!-- MODAL KONFIRMASI PEMBATALAN -->
    <Teleport to="body">
      <div
        v-if="cancelModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      >
        <div class="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
          <h3 class="font-bold text-slate-900 text-base">
            {{ req?.status === 'DRAFT' ? 'Hapus Draf Pengajuan?' : 'Batalkan Pengajuan Izin?' }}
          </h3>
          <p class="text-xs text-slate-600 leading-relaxed">
            {{ req?.status === 'DRAFT'
              ? 'Draf pengajuan ini akan dihapus permanen beserta seluruh lampiran.'
              : 'Pengajuan akan dibatalkan, kuota cuti yang dipesan akan dikembalikan, dan tugas approval yang sedang berjalan akan dihentikan.'
            }}
          </p>

          <div v-if="req?.status !== 'DRAFT'" class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-700">
              Alasan Pembatalan <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="cancelReason"
              rows="3"
              placeholder="Tuliskan alasan pembatalan..."
              class="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              class="px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
              :disabled="cancelling"
              @click="cancelModalOpen = false"
            >
              Kembali
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              :disabled="cancelling || (req?.status !== 'DRAFT' && cancelReason.trim().length < 5)"
              @click="handleConfirmCancel"
            >
              {{ cancelling ? 'Memproses...' : req?.status === 'DRAFT' ? 'Ya, Hapus' : 'Ya, Batalkan' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
