<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
const templateId = computed(() => route.params.id as string)

const { data: res, pending, refresh } = await useFetch<{ data: any }>(`/api/admin/notifications/templates/${templateId.value}`)
const tpl = computed(() => res.value?.data)

useHead({
  title: computed(() => tpl.value ? `Edit ${tpl.value.name} · Admin` : 'Edit Template Notifikasi'),
})

// Variables list
const { data: varRes } = await useFetch<{ data: any[] }>('/api/admin/notifications/variables')
const availableVariables = computed(() => varRes.value?.data ?? [])

// Form state
const formName = ref('')
const formSubject = ref('')
const formBody = ref('')
const formParseMode = ref('HTML')
const formIsActive = ref(true)

const isSaving = ref(false)
const isResetting = ref(false)
const isSendingTest = ref(false)
const toastMessage = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

// Focus tracking for variable insertion
const focusedInput = ref<'subject' | 'body'>('body')
const subjectInputRef = ref<HTMLInputElement | null>(null)
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null)

// Live Preview state
const previewSubject = ref('')
const previewBody = ref('')
const previewUnknownKeys = ref<string[]>([])
const isPreviewLoading = ref(false)
const unknownKeysFormatted = computed(() => previewUnknownKeys.value.map((k) => `{{${k}}}`).join(', '))

function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  toastMessage.value = { type, text }
  setTimeout(() => {
    toastMessage.value = null
  }, 4500)
}

function initFormData() {
  if (tpl.value) {
    formName.value = tpl.value.name || ''
    formSubject.value = tpl.value.subject_template || ''
    formBody.value = tpl.value.body_template || ''
    formParseMode.value = tpl.value.parse_mode || 'HTML'
    formIsActive.value = Boolean(tpl.value.is_active)
    updatePreview()
  }
}

watch(tpl, () => {
  initFormData()
}, { immediate: true })

// Debounced live preview updater
let previewTimeout: NodeJS.Timeout | null = null

async function updatePreview() {
  if (!tpl.value) return
  isPreviewLoading.value = true
  try {
    const res = await $fetch<{ success: boolean; subject: string; body: string; unknownKeys: string[] }>('/api/admin/notifications/preview', {
      method: 'POST',
      body: {
        subject_template: formSubject.value,
        body_template: formBody.value,
        channel: tpl.value.channel,
      },
    })
    previewSubject.value = res.subject
    previewBody.value = res.body
    previewUnknownKeys.value = res.unknownKeys || []
  } catch (err: any) {
    // preview error
  } finally {
    isPreviewLoading.value = false
  }
}

function onContentChange() {
  if (previewTimeout) clearTimeout(previewTimeout)
  previewTimeout = setTimeout(() => {
    updatePreview()
  }, 350)
}

function insertVariable(varKey: string) {
  if (focusedInput.value === 'subject' && tpl.value?.channel === 'EMAIL' && subjectInputRef.value) {
    const el = subjectInputRef.value
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    formSubject.value = formSubject.value.substring(0, start) + varKey + formSubject.value.substring(end)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + varKey.length, start + varKey.length)
      onContentChange()
    }, 50)
  } else if (bodyTextareaRef.value) {
    const el = bodyTextareaRef.value
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    formBody.value = formBody.value.substring(0, start) + varKey + formBody.value.substring(end)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + varKey.length, start + varKey.length)
      onContentChange()
    }, 50)
  }
}

async function saveTemplate() {
  if (!tpl.value) return
  isSaving.value = true
  try {
    await $fetch(`/api/admin/notifications/templates/${templateId.value}`, {
      method: 'PATCH',
      body: {
        name: formName.value,
        subject_template: tpl.value.channel === 'EMAIL' ? formSubject.value : null,
        body_template: formBody.value,
        parse_mode: formParseMode.value,
        is_active: formIsActive.value,
      },
    })
    showToast('Perubahan template berhasil disimpan.', 'success')
    await refresh()
  } catch (err: any) {
    showToast(err?.data?.message || err?.message || 'Gagal menyimpan template.', 'error')
  } finally {
    isSaving.value = false
  }
}

async function resetTemplate() {
  if (!confirm('Apakah Anda yakin ingin mengembalikan template ini ke format bawaan sistem? Perubahan yang belum disimpan akan hilang.')) {
    return
  }
  isResetting.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string; data: any }>(`/api/admin/notifications/templates/${templateId.value}/reset`, {
      method: 'POST',
    })
    showToast(res.message || 'Template berhasil direset ke bawaan.', 'success')
    await refresh()
    initFormData()
  } catch (err: any) {
    showToast(err?.data?.message || err?.message || 'Gagal mereset template.', 'error')
  } finally {
    isResetting.value = false
  }
}

async function sendTestNotification() {
  if (!tpl.value) return
  isSendingTest.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string; simulated?: boolean }>('/api/admin/notifications/test-send', {
      method: 'POST',
      body: {
        subject_template: formSubject.value,
        body_template: formBody.value,
        channel: tpl.value.channel,
      },
    })
    showToast(res.message, res.simulated ? 'info' : 'success')
  } catch (err: any) {
    showToast(err?.data?.message || err?.message || 'Gagal mengirim pesan uji.', 'error')
  } finally {
    isSendingTest.value = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Toast Notification -->
    <transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toastMessage"
        :class="{
          'bg-emerald-600 text-white': toastMessage.type === 'success',
          'bg-rose-600 text-white': toastMessage.type === 'error',
          'bg-blue-600 text-white': toastMessage.type === 'info',
        }"
        class="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3 text-xs sm:text-sm font-medium"
      >
        <span>{{ toastMessage.text }}</span>
        <button type="button" class="opacity-80 hover:opacity-100" @click="toastMessage = null">✕</button>
      </div>
    </transition>

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
          <span class="text-slate-700 font-mono">{{ tpl?.code || 'Detail' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
            {{ tpl?.name || 'Memuat template...' }}
          </h1>
          <span
            v-if="tpl?.channel === 'EMAIL'"
            class="badge bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold"
          >
            EMAIL
          </span>
          <span
            v-else-if="tpl?.channel === 'TELEGRAM'"
            class="badge bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold"
          >
            TELEGRAM
          </span>
        </div>
        <p class="text-xs text-slate-500 mt-0.5">
          Event: <span class="font-semibold text-slate-700">{{ tpl?.event_type }}</span> &bull; Target: <span class="font-semibold text-slate-700">{{ tpl?.target_audience }}</span>
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          :disabled="isResetting"
          class="btn-secondary text-xs sm:text-sm flex items-center gap-1.5 text-rose-600 hover:border-rose-300"
          @click="resetTemplate"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Kembalikan ke Bawaan
        </button>
        <button
          type="button"
          :disabled="isSendingTest"
          class="btn-secondary text-xs sm:text-sm flex items-center gap-1.5 text-blue-600 hover:border-blue-300"
          @click="sendTestNotification"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          {{ isSendingTest ? 'Mengirim...' : 'Kirim Uji ke Saya' }}
        </button>
        <button
          type="button"
          :disabled="isSaving"
          class="btn-primary text-xs sm:text-sm flex items-center gap-1.5"
          @click="saveTemplate"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ isSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </button>
      </div>
    </div>

    <!-- Error Alert if Unknown Placeholders -->
    <div
      v-if="previewUnknownKeys.length > 0"
      class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800"
    >
      <div class="font-bold flex items-center gap-1.5">
        <svg class="h-4 w-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Peringatan: Variabel Placeholder Tidak Dikenal
      </div>
      <p class="mt-1">
        Template Anda menggunakan variabel:
        <code class="font-bold text-rose-900">{{ unknownKeysFormatted }}</code>
        yang tidak terdaftar dalam kamus variabel resmi sistem. Variabel ini tidak akan dapat diinterpolasi saat pengiriman.
      </p>
    </div>

    <!-- Main Grid: Left Editor & Right Live Preview -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- LEFT: Editor Form (7 cols) -->
      <div class="space-y-4 lg:col-span-7">
        <div class="card p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 class="text-sm font-bold text-slate-800">Editor Konten Template</h2>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="formIsActive"
                type="checkbox"
                class="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
              />
              <span class="text-xs font-semibold text-slate-700">Status Aktif</span>
            </label>
          </div>

          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Nama Template</label>
            <input
              v-model="formName"
              type="text"
              class="input-text w-full text-xs sm:text-sm"
              placeholder="Contoh: Tugas Approval Baru (Email)"
            />
          </div>

          <!-- Subject Template (Email Only) -->
          <div v-if="tpl?.channel === 'EMAIL'">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-slate-700">Subjek Email</label>
              <span class="text-[11px] text-slate-400">Mendukung placeholder &#123;&#123;variabel&#125;&#125;</span>
            </div>
            <input
              ref="subjectInputRef"
              v-model="formSubject"
              type="text"
              class="input-text w-full text-xs sm:text-sm font-mono"
              placeholder="Contoh: [{{app_name}}] Persetujuan dibutuhkan: {{leave_type_name}}"
              @focus="focusedInput = 'subject'"
              @input="onContentChange"
            />
          </div>

          <!-- Body Template -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-slate-700">
                Isi Pesan (Body Template)
              </label>
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-slate-400">Mode:</span>
                <select v-model="formParseMode" class="input-select text-[11px] py-0.5 px-2">
                  <option value="HTML">HTML</option>
                  <option value="TEXT">Plain Text</option>
                </select>
              </div>
            </div>
            <textarea
              ref="bodyTextareaRef"
              v-model="formBody"
              rows="14"
              class="input-textarea w-full text-xs sm:text-sm font-mono leading-relaxed"
              placeholder="Tuliskan format isi pesan notifikasi di sini..."
              @focus="focusedInput = 'body'"
              @input="onContentChange"
            ></textarea>
            <p class="mt-1 text-[11px] text-slate-400">
              <span v-if="tpl?.channel === 'TELEGRAM'">
                Tips Telegram: Tag didukung adalah <code>&lt;b&gt;tebal&lt;/b&gt;</code>, <code>&lt;i&gt;miring&lt;/i&gt;</code>, <code>&lt;a href="..."&gt;tautan&lt;/a&gt;</code>, <code>&lt;code&gt;kode&lt;/code&gt;</code>.
              </span>
              <span v-else>
                Tips Email: Paragraf dipisahkan dengan baris kosong ganda. Tautan dapat menggunakan <code>&lt;a href="..."&gt;</code> atau placeholder <code>&#123;&#123;action_url&#125;&#125;</code>.
              </span>
            </p>
          </div>
        </div>

        <!-- Available Variables Pills Panel -->
        <div class="card p-5">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700">
              Kamus Variabel Resmi (Klik untuk Menyisipkan)
            </h3>
            <span class="text-[11px] text-slate-400">Menyisipkan ke: <b class="text-brand-600 uppercase">{{ focusedInput }}</b></span>
          </div>
          <div class="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
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
        </div>
      </div>

      <!-- RIGHT: Live Preview Simulator (5 cols) -->
      <div class="space-y-4 lg:col-span-5">
        <div class="card p-5 sticky top-6">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-slate-800">Pratinjau Langsung (Live Preview)</h2>
              <span v-if="isPreviewLoading" class="text-[10px] text-brand-600 animate-pulse font-semibold">Memperbarui...</span>
            </div>
            <span class="text-[10px] text-slate-400">Data Contoh Nyata</span>
          </div>

          <!-- Email Preview Simulator -->
          <div v-if="tpl?.channel === 'EMAIL'" class="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-slate-50">
            <!-- Simulated Browser/Email Header -->
            <div class="bg-white border-b border-slate-200 px-4 py-3 text-xs space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-500 w-12">Dari:</span>
                <span class="text-slate-800 font-semibold">Sistem Perizinan &lt;no-reply@perusahaan.co.id&gt;</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-500 w-12">Subjek:</span>
                <span class="text-slate-900 font-bold">{{ previewSubject || '(Tanpa Subjek)' }}</span>
              </div>
            </div>

            <!-- Simulated Email Body Container -->
            <div class="p-4 bg-slate-100">
              <div class="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                <!-- Email Blue Header Banner -->
                <div class="bg-gradient-to-r from-blue-900 to-blue-600 px-5 py-4 text-white">
                  <div class="font-bold text-sm">Sistem Perizinan Pegawai</div>
                  <div class="text-[11px] text-blue-100">Notifikasi Otomatis Kepegawaian</div>
                </div>

                <!-- Email Message Content -->
                <div class="p-5 text-xs text-slate-700 leading-relaxed space-y-3 whitespace-pre-line font-sans" v-html="previewBody"></div>

                <!-- Email Action Button -->
                <div class="p-4 text-center border-t border-slate-50">
                  <div class="inline-block bg-blue-600 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-sm">
                    Buka Halaman Terkait
                  </div>
                </div>

                <!-- Email Footer -->
                <div class="bg-slate-50 border-t border-slate-100 p-3 text-center text-[10px] text-slate-400">
                  Email ini dikirimkan otomatis oleh sistem perizinan. Mohon tidak membalas email ini.
                </div>
              </div>
            </div>
          </div>

          <!-- Telegram Preview Simulator -->
          <div v-else-if="tpl?.channel === 'TELEGRAM'" class="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-[#0e1621] text-white">
            <!-- Simulated Telegram App Top Bar -->
            <div class="bg-[#17212b] px-4 py-3 border-b border-[#242f3d] flex items-center gap-3">
              <div class="h-9 w-9 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center font-bold text-white text-xs">
                🤖
              </div>
              <div>
                <div class="text-xs font-bold text-white">Sistem Perizinan Bot</div>
                <div class="text-[10px] text-sky-400">bot</div>
              </div>
            </div>

            <!-- Chat Bubble Area -->
            <div class="p-4 bg-[#0e1621] min-h-[300px] flex flex-col justify-end">
              <div class="max-w-[88%] bg-[#182533] rounded-2xl rounded-bl-sm p-3.5 border border-[#2b5278]/40 shadow-md">
                <div class="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line" v-html="previewBody"></div>
                <div class="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                  <span>14:30</span>
                  <span>✓✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Simulator Note -->
          <div class="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 border border-slate-100">
            <span class="font-semibold text-slate-700">Keterangan:</span> Nilai dalam tanda kurung kurawal digantikan oleh data pemohon, batas waktu SLA, dan URL dinamis saat proses pengiriman asli.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
