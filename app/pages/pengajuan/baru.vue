<script setup lang="ts">
import dayjs from 'dayjs'

const { t, locale } = useI18n()

useHead({
  title: computed(() => t('requests.newRequest')),
})

const router = useRouter()

// 1. Fetch form options (allowed leave types, quotas, peers)
const { data: optionsData, pending: optionsPending, error: optionsError } = await useFetch<{
  data: {
    canSubmit: boolean
    leaveTypes: any[]
    quotas: any[]
    peers: any[]
  }
}>('/api/requests/form-options')

const allowedLeaveTypes = computed(() => optionsData.value?.data?.leaveTypes ?? [])
const quotas = computed(() => optionsData.value?.data?.quotas ?? [])
const peers = computed(() => optionsData.value?.data?.peers ?? [])

// Form state
const form = reactive({
  leaveTypeId: '',
  startDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  endDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  startDayPart: 'FULL_DAY' as 'FULL_DAY' | 'MORNING' | 'AFTERNOON',
  endDayPart: 'FULL_DAY' as 'FULL_DAY' | 'MORNING' | 'AFTERNOON',
  reason: '',
  addressDuringLeave: '',
  contactPhone: '',
  delegateEmployeeId: '',
})

// Auto-select first leave type
watch(
  allowedLeaveTypes,
  (types) => {
    if (types.length > 0 && !form.leaveTypeId) {
      form.leaveTypeId = types[0].id
    }
  },
  { immediate: true }
)

const selectedLeaveType = computed(() =>
  allowedLeaveTypes.value.find((lt) => lt.id === form.leaveTypeId)
)

const currentQuota = computed(() => {
  if (!selectedLeaveType.value?.deductsQuota) return null
  return quotas.value.find((q) => q.leaveTypeId === form.leaveTypeId)
})

// Preview state
const previewData = ref<any>(null)
const previewLoading = ref(false)
const previewError = ref('')

let debounceTimer: any = null

function triggerPreview() {
  if (!form.leaveTypeId || !form.startDate || !form.endDate) return
  if (form.endDate < form.startDate) {
    previewData.value = null
    previewError.value = 'Tanggal selesai tidak boleh sebelum tanggal mulai.'
    return
  }

  previewLoading.value = true
  previewError.value = ''
  clearTimeout(debounceTimer)

  debounceTimer = setTimeout(async () => {
    try {
      const res = await $fetch<{ data: any }>('/api/requests/preview', {
        method: 'POST',
        body: {
          leaveTypeId: form.leaveTypeId,
          startDate: form.startDate,
          endDate: form.endDate,
          startDayPart: form.startDayPart,
          endDayPart: form.endDayPart,
          reason: form.reason || 'Keterangan pengajuan cuti atau izin sementara.',
        },
      })
      previewData.value = res.data
    } catch (err: any) {
      previewError.value = err?.data?.message || err?.statusMessage || 'Gagal menghitung durasi.'
      previewData.value = null
    } finally {
      previewLoading.value = false
    }
  }, 500)
}

watch(
  [
    () => form.leaveTypeId,
    () => form.startDate,
    () => form.endDate,
    () => form.startDayPart,
    () => form.endDayPart,
  ],
  () => {
    triggerPreview()
  },
  { immediate: true }
)

// File attachment state
const selectedFiles = ref<File[]>([])
const fileError = ref('')

const uploadedFileList = computed(() =>
  selectedFiles.value.map((f) => ({
    name: f.name,
    sizeBytes: f.size,
  }))
)

function handleFilesSelected(fileList: FileList) {
  fileError.value = ''
  const newFiles = Array.from(fileList)
  if (selectedFiles.value.length + newFiles.length > 5) {
    fileError.value = 'Maksimal 5 berkas lampiran.'
    return
  }

  for (const f of newFiles) {
    if (f.size > 5 * 1024 * 1024) {
      fileError.value = `Berkas ${f.name} melebihi 5 MB.`
      return
    }
    selectedFiles.value.push(f)
  }
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
}

// Submit state
const submitting = ref(false)
const submitError = ref('')

const isBlocked = computed(() => {
  return Boolean(previewData.value?.ruleResult?.blockingMessages?.length > 0)
})

async function handleSubmit(actionType: 'draft' | 'submit') {
  submitError.value = ''

  if (actionType === 'submit' && isBlocked.value) {
    submitError.value = 'Pengajuan terhalang oleh aturan yang belum terpenuhi.'
    return
  }

  if (actionType === 'submit' && form.reason.trim().length < 10) {
    submitError.value = 'Alasan pengajuan minimal 10 karakter.'
    return
  }

  submitting.value = true
  try {
    // 1. Buat pengajuan
    const res = await $fetch<{ data: any }>('/api/requests', {
      method: 'POST',
      body: {
        ...form,
        delegateEmployeeId: form.delegateEmployeeId || null,
        action: actionType,
      },
    })

    const createdReq = res.data

    // 2. Unggah lampiran jika ada
    if (selectedFiles.value.length > 0) {
      for (const file of selectedFiles.value) {
        const formData = new FormData()
        formData.append('file', file)
        try {
          await $fetch(`/api/requests/${createdReq.id}/attachments`, {
            method: 'POST',
            body: formData,
          })
        } catch (uploadErr) {
          console.error('Lampiran gagal diunggah:', uploadErr)
        }
      }
    }

    // Arahkan ke halaman detail
    await router.push(`/pengajuan/${createdReq.id}`)
  } catch (err: any) {
    submitError.value = err?.data?.message || err?.statusMessage || 'Gagal menyimpan pengajuan.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-xl mx-auto pb-28">
    <AppPageHeader
      :title="t('requests.newRequest')"
      :subtitle="t('requests.submitConfirmMsg')"
    />

    <!-- Error Hak Pengajuan -->
    <div
      v-if="optionsError || (optionsData?.data && !optionsData.data.canSubmit)"
      class="p-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 space-y-2"
    >
      <div class="font-bold flex items-center gap-2">
        <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Hak Pengajuan Dinonaktifkan
      </div>
      <p>
        {{ (optionsError as any)?.data?.message || optionsError?.statusMessage || 'Anda saat ini tidak berhak membuat pengajuan perizinan. Silakan hubungi bagian HRD atau Administrator.' }}
      </p>
      <NuxtLink to="/pengajuan" class="inline-block mt-2 font-semibold text-red-800 underline">
        {{ t('common.back') }}
      </NuxtLink>
    </div>

    <!-- Form Utama -->
    <form v-else class="space-y-6" @submit.prevent>
      <!-- LANGKAH 1: PILIH JENIS IZIN -->
      <section class="card space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span class="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">1</span>
            {{ t('requests.selectLeaveType') }}
          </h2>
          <span v-if="currentQuota" class="text-xs font-semibold text-slate-500 tabular-nums">
            {{ t('home.remainingDays') }}: <span class="text-blue-600 font-bold">{{ currentQuota.balance }}</span> {{ t('common.days').toLowerCase() }}
          </span>
        </div>

        <!-- Grid Kartu Jenis Izin (Mobile Friendly) -->
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <button
            v-for="lt in allowedLeaveTypes"
            :key="lt.id"
            type="button"
            class="p-3 text-left rounded-xl border-2 transition flex flex-col justify-between gap-2 active:scale-95 min-h-[44px]"
            :class="
              form.leaveTypeId === lt.id
                ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            "
            @click="form.leaveTypeId = lt.id"
          >
            <div class="flex items-center justify-between">
              <span
                class="w-3 h-3 rounded-full shrink-0"
                :style="{ backgroundColor: lt.color || '#3b82f6' }"
              ></span>
              <span v-if="lt.deductsQuota" class="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                Potong Kuota
              </span>
            </div>
            <div>
              <h4 class="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">{{ lt.name }}</h4>
              <p v-if="lt.description" class="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                {{ lt.description }}
              </p>
            </div>
          </button>
        </div>

        <!-- Informasi Ketentuan Jenis Izin -->
        <div
          v-if="selectedLeaveType"
          class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1"
        >
          <div class="font-semibold text-slate-900 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ketentuan {{ selectedLeaveType.name }}:
          </div>
          <p class="text-slate-600">
            {{ selectedLeaveType.description || 'Tidak ada catatan khusus.' }}
            <span v-if="selectedLeaveType.requiresAttachment" class="font-semibold text-amber-700 block mt-0.5">
              ⚠️ Wajib melampirkan berkas bukti pendukung.
            </span>
          </p>
        </div>
      </section>

      <!-- LANGKAH 2: TANGGAL & DURASI -->
      <section class="card space-y-4">
        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span class="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">2</span>
          Tanggal & Durasi
        </h2>

        <AppDateRange
          v-model:start-date="form.startDate"
          v-model:end-date="form.endDate"
          :working-days="previewData?.workingDays"
          :total-days="previewData?.totalDays"
        />

        <!-- Opsi Setengah Hari bila Diizinkan -->
        <div v-if="selectedLeaveType?.allowHalfDay" class="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Porsi Hari Mulai</label>
            <select
              v-model="form.startDayPart"
              class="input text-xs"
            >
              <option value="FULL_DAY">Seharian Penuh</option>
              <option value="MORNING">Pagi</option>
              <option value="AFTERNOON">Siang</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Porsi Hari Selesai</label>
            <select
              v-model="form.endDayPart"
              class="input text-xs"
            >
              <option value="FULL_DAY">Seharian Penuh</option>
              <option value="MORNING">Pagi</option>
              <option value="AFTERNOON">Siang</option>
            </select>
          </div>
        </div>

        <p v-if="previewError" class="text-xs text-red-600 font-medium">
          {{ previewError }}
        </p>

        <!-- Banner Hasil Evaluasi Aturan (Pre-check) -->
        <div v-if="previewData?.ruleResult" class="space-y-2 pt-1">
          <!-- BLOCK_SUBMIT (Merah) -->
          <div
            v-if="previewData.ruleResult.blockingMessages?.length > 0"
            class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1"
          >
            <div class="font-bold flex items-center gap-1.5">
              <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pengajuan Terhalang Aturan:
            </div>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="(msg, i) in previewData.ruleResult.blockingMessages" :key="i">{{ msg }}</li>
            </ul>
          </div>

          <!-- AUTO_REJECT (Oranye) -->
          <div
            v-else-if="previewData.ruleResult.autoRejectMessages?.length > 0"
            class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1"
          >
            <div class="font-bold flex items-center gap-1.5">
              <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Peringatan Kebijakan:
            </div>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="(msg, i) in previewData.ruleResult.autoRejectMessages" :key="i">{{ msg }}</li>
            </ul>
            <p class="text-[11px] text-amber-700 italic">
              Pengajuan tetap bisa dikirim, tetapi berpotensi ditolak otomatis bila melewati batas waktu.
            </p>
          </div>

          <!-- MANUAL APPROVAL REQUIRED (Biru) -->
          <div
            v-else-if="previewData.ruleResult.requiresManualApproval"
            class="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-start gap-2"
          >
            <svg class="w-4 h-4 text-sky-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>Pengajuan ini memerlukan persetujuan manual dari atasan/HRD dan tidak dapat disetujui secara otomatis.</div>
          </div>

          <!-- LOLOS SEMUA (Hijau) -->
          <div
            v-else
            class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2"
          >
            <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>Memenuhi seluruh ketentuan aturan perizinan.</div>
          </div>
        </div>
      </section>

      <!-- LANGKAH 3: ALASAN, DELEGASI & LAMPIRAN -->
      <section class="card space-y-4">
        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span class="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">3</span>
          Alasan & Lampiran
        </h2>

        <AppFormField label="Alasan Pengajuan" required hint="Min. 10 karakter">
          <textarea
            v-model="form.reason"
            rows="3"
            required
            placeholder="Tuliskan alasan pengajuan secara jelas..."
            class="input"
          ></textarea>
        </AppFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AppFormField label="Pelimpahan Tugas (Delegasi)">
            <select
              v-model="form.delegateEmployeeId"
              class="input"
            >
              <option value="">-- Tidak Ada Pelimpahan --</option>
              <option v-for="p in peers" :key="p.id" :value="p.id">
                {{ p.fullName }} ({{ p.positionName || p.nip }})
              </option>
            </select>
          </AppFormField>

          <AppFormField label="No. Telepon Darurat">
            <input
              v-model="form.contactPhone"
              type="tel"
              inputmode="tel"
              placeholder="08123456789"
              class="input"
            />
          </AppFormField>
        </div>

        <AppFormField label="Alamat / Lokasi Selama Izin">
          <input
            v-model="form.addressDuringLeave"
            type="text"
            placeholder="Contoh: Rumah / Luar kota"
            class="input"
          />
        </AppFormField>

        <!-- Unggah Lampiran -->
        <div class="space-y-2 pt-2 border-t border-slate-100">
          <div class="flex items-center justify-between">
            <label class="label text-xs">
              Lampiran Pendukung
              <span v-if="selectedLeaveType?.requiresAttachment" class="text-red-500 font-bold">*Wajib</span>
            </label>
            <span class="text-[11px] text-slate-400">Maks. 5 berkas (@5MB)</span>
          </div>

          <AppFileUpload
            :files="uploadedFileList"
            :multiple="true"
            @select="handleFilesSelected"
            @remove="removeFile"
          />
          <p v-if="fileError" class="text-xs text-red-600 font-medium">{{ fileError }}</p>
        </div>
      </section>

      <!-- Submit Error Banner -->
      <div v-if="submitError" class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
        {{ submitError }}
      </div>

      <!-- Sticky Bottom Action Bar (Thumb Zone) -->
      <AppStickyActions>
        <button
          type="button"
          class="btn-ghost flex-1"
          :disabled="submitting"
          @click="handleSubmit('draft')"
        >
          {{ locale === 'en' ? 'Save Draft' : 'Simpan Draf' }}
        </button>

        <button
          type="button"
          class="btn-primary flex-1"
          :disabled="submitting || isBlocked"
          @click="handleSubmit('submit')"
        >
          {{ submitting ? t('common.processing') : t('common.submit') }}
        </button>
      </AppStickyActions>
    </form>
  </div>
</template>

