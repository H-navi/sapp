<script setup lang="ts">
useHead({
  title: 'Buat Template Notifikasi Baru · Admin',
})

const router = useRouter()

// Fetch leave types for scoping
const { data: leaveTypesRes } = await useFetch<{ data: any[] }>('/api/admin/leave-types')
const leaveTypes = computed(() => leaveTypesRes.value?.data ?? [])

// Variables
const { data: varRes } = await useFetch<{ data: any[] }>('/api/admin/notifications/variables')
const availableVariables = computed(() => varRes.value?.data ?? [])

// Form state
const code = ref('')
const name = ref('')
const eventType = ref('APPROVAL_TASK_ASSIGNED')
const channel = ref<'EMAIL' | 'TELEGRAM'>('EMAIL')
const targetAudience = ref('APPROVER')
const selectedLeaveTypeId = ref('')
const subject = ref('')
const body = ref('')
const parseMode = ref('HTML')

const isSubmitting = ref(false)
const errorMessage = ref('')

const focusedInput = ref<'subject' | 'body'>('body')
const subjectInputRef = ref<HTMLInputElement | null>(null)
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null)

function insertVariable(varKey: string) {
  if (focusedInput.value === 'subject' && channel.value === 'EMAIL' && subjectInputRef.value) {
    const el = subjectInputRef.value
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    subject.value = subject.value.substring(0, start) + varKey + subject.value.substring(end)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + varKey.length, start + varKey.length)
    }, 50)
  } else if (bodyTextareaRef.value) {
    const el = bodyTextareaRef.value
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    body.value = body.value.substring(0, start) + varKey + body.value.substring(end)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + varKey.length, start + varKey.length)
    }, 50)
  }
}

async function createTemplate() {
  errorMessage.value = ''
  if (!code.value.trim() || !name.value.trim() || !body.value.trim()) {
    errorMessage.value = 'Kode, nama template, dan isi pesan wajib diisi.'
    return
  }

  isSubmitting.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { id: string } }>('/api/admin/notifications/templates', {
      method: 'POST',
      body: {
        code: code.value.trim().toUpperCase(),
        name: name.value.trim(),
        event_type: eventType.value,
        channel: channel.value,
        target_audience: targetAudience.value,
        leave_type_id: selectedLeaveTypeId.value || null,
        subject_template: channel.value === 'EMAIL' ? subject.value.trim() : null,
        body_template: body.value.trim(),
        parse_mode: parseMode.value,
        is_active: true,
      },
    })

    router.push(`/admin/notifikasi/${res.data.id}`)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Gagal membuat template baru.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Header Navigasi -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <NuxtLink to="/admin/notifikasi" class="hover:text-brand-600 transition-colors flex items-center gap-1">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Template Notifikasi
          </NuxtLink>
          <span>/</span>
          <span class="text-slate-700">Buat Baru</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
          Buat Template Notifikasi Khusus
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          Buat template yang otomatis diprioritaskan untuk jenis izin atau target audiens tertentu.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink to="/admin/notifikasi" class="btn-secondary text-xs sm:text-sm">
          Batal
        </NuxtLink>
        <button
          type="button"
          :disabled="isSubmitting"
          class="btn-primary text-xs sm:text-sm flex items-center gap-1.5"
          @click="createTemplate"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ isSubmitting ? 'Menyimpan...' : 'Simpan Template' }}
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="errorMessage" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800">
      {{ errorMessage }}
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- Left Form (7 cols) -->
      <div class="space-y-4 lg:col-span-7">
        <div class="card p-5 space-y-4">
          <h2 class="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Konfigurasi Template</h2>

          <!-- Event, Channel, Audience -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Jenis Event</label>
              <select v-model="eventType" class="input-select w-full text-xs">
                <option value="APPROVAL_TASK_ASSIGNED">Tugas Approval Baru</option>
                <option value="APPROVAL_REMINDER">Pengingat SLA</option>
                <option value="APPROVAL_ESCALATED">Eskalasi</option>
                <option value="REQUEST_SUBMITTED">Pengajuan Terkirim</option>
                <option value="STEP_APPROVED">Tahap Disetujui</option>
                <option value="REQUEST_APPROVED">Pengajuan Disetujui</option>
                <option value="REQUEST_REJECTED">Pengajuan Ditolak</option>
                <option value="REQUEST_AUTO_APPROVED">Disetujui Otomatis</option>
                <option value="REQUEST_AUTO_REJECTED">Ditolak Otomatis</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Kanal Pengiriman</label>
              <select v-model="channel" class="input-select w-full text-xs">
                <option value="EMAIL">Email (HTML)</option>
                <option value="TELEGRAM">Telegram Bot</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Target Audiens</label>
              <select v-model="targetAudience" class="input-select w-full text-xs">
                <option value="APPROVER">Approver</option>
                <option value="REQUESTER">Pemohon</option>
                <option value="ADMIN">Administrator</option>
                <option value="HR">HR / SDM</option>
              </select>
            </div>
          </div>

          <!-- Scope: Jenis Izin Opsional -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">
              Khusus Jenis Izin Tertentu (Opsional)
            </label>
            <select v-model="selectedLeaveTypeId" class="input-select w-full text-xs">
              <option value="">-- Berlaku untuk Semua Jenis Izin --</option>
              <option v-for="lt in leaveTypes" :key="lt.id" :value="lt.id">
                {{ lt.name }} ({{ lt.code }})
              </option>
            </select>
            <p class="text-[11px] text-slate-400 mt-1">
              Jika dipilih, template ini otomatis mengoverride template bawaan saat jenis izin bersangkutan diajukan.
            </p>
          </div>

          <!-- Code & Name -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Kode Template (Unik)</label>
              <input
                v-model="code"
                type="text"
                class="input-text w-full text-xs sm:text-sm font-mono uppercase"
                placeholder="TPL_CUSTOM_CUTI_TAHUNAN"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Nama Deskriptif</label>
              <input
                v-model="name"
                type="text"
                class="input-text w-full text-xs sm:text-sm"
                placeholder="Persetujuan Cuti Tahunan Khusus"
              />
            </div>
          </div>

          <!-- Subject (Email) -->
          <div v-if="channel === 'EMAIL'">
            <label class="block text-xs font-semibold text-slate-700 mb-1">Subjek Email</label>
            <input
              ref="subjectInputRef"
              v-model="subject"
              type="text"
              class="input-text w-full text-xs sm:text-sm font-mono"
              placeholder="[{{app_name}}] Pengajuan {{leave_type_name}} - {{employee_name}}"
              @focus="focusedInput = 'subject'"
            />
          </div>

          <!-- Body -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-slate-700">Isi Pesan (Body Template)</label>
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-slate-400">Parse Mode:</span>
                <select v-model="parseMode" class="input-select text-[11px] py-0.5 px-2">
                  <option value="HTML">HTML</option>
                  <option value="TEXT">Plain Text</option>
                </select>
              </div>
            </div>
            <textarea
              ref="bodyTextareaRef"
              v-model="body"
              rows="12"
              class="input-textarea w-full text-xs sm:text-sm font-mono leading-relaxed"
              placeholder="Tuliskan format isi pesan template di sini..."
              @focus="focusedInput = 'body'"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Right Helper (5 cols) -->
      <div class="space-y-4 lg:col-span-5">
        <div class="card p-5 sticky top-6">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700">
              Kamus Variabel Resmi (Klik untuk Menyisipkan)
            </h3>
            <span class="text-[11px] text-slate-400">Ke: <b class="text-brand-600 uppercase">{{ focusedInput }}</b></span>
          </div>
          <div class="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto pr-1">
            <button
              v-for="v in availableVariables"
              :key="v.id"
              type="button"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 transition-colors"
              :title="`${v.description} (Contoh: ${v.example_value || '-'})`"
              @click="insertVariable(v.variable_key)"
            >
              <span>{{ v.variable_key }}</span>
              <span class="text-[10px] text-slate-400">&plus;</span>
            </button>
          </div>
          <div class="mt-4 p-3 bg-brand-50 text-brand-800 rounded-lg text-xs leading-relaxed">
            <div class="font-bold">Prioritas Template:</div>
            Template khusus per jenis izin atau tahap persetujuan memiliki derajat spesifisitas lebih tinggi dibanding template bawaan sistem.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
