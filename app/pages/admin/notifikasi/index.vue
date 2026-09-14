<script setup lang="ts">
useHead({
  title: 'Template & Notifikasi · Admin',
})

const route = useRoute()
const search = ref('')
const selectedChannel = ref<string>('ALL')
const selectedAudience = ref<string>('ALL')

const { data: res, pending, refresh } = await useFetch<{ data: any[] }>('/api/admin/notifications/templates')
const templates = computed(() => res.value?.data ?? [])

// Filtered templates
const filteredTemplates = computed(() => {
  return templates.value.filter((t) => {
    if (selectedChannel.value !== 'ALL' && t.channel !== selectedChannel.value) return false
    if (selectedAudience.value !== 'ALL' && t.target_audience !== selectedAudience.value) return false
    if (search.value.trim()) {
      const q = search.value.toLowerCase()
      const matchName = t.name?.toLowerCase().includes(q)
      const matchCode = t.code?.toLowerCase().includes(q)
      const matchSubj = t.subject_template?.toLowerCase().includes(q)
      const matchBody = t.body_template?.toLowerCase().includes(q)
      if (!matchName && !matchCode && !matchSubj && !matchBody) return false
    }
    return true
  })
})

// Grouped by event_type
const groupedTemplates = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const t of filteredTemplates.value) {
    if (!groups[t.event_type]) {
      groups[t.event_type] = []
    }
    groups[t.event_type].push(t)
  }
  return groups
})

// Metrics
const countTotal = computed(() => templates.value.length)
const countEmail = computed(() => templates.value.filter((t) => t.channel === 'EMAIL').length)
const countTelegram = computed(() => templates.value.filter((t) => t.channel === 'TELEGRAM').length)
const countCustom = computed(() => templates.value.filter((t) => !t.is_default).length)

function formatEventName(evt: string) {
  switch (evt) {
    case 'APPROVAL_TASK_ASSIGNED':
      return 'Tugas Approval Baru'
    case 'APPROVAL_REMINDER':
      return 'Pengingat Batas Waktu SLA'
    case 'APPROVAL_ESCALATED':
      return 'Eskalasi Melewati SLA'
    case 'REQUEST_SUBMITTED':
      return 'Pengajuan Terkirim'
    case 'STEP_APPROVED':
      return 'Tahap Disetujui'
    case 'REQUEST_APPROVED':
      return 'Pengajuan Disetujui Penuh'
    case 'REQUEST_REJECTED':
      return 'Pengajuan Ditolak'
    case 'REQUEST_AUTO_APPROVED':
      return 'Disetujui Otomatis'
    case 'REQUEST_AUTO_REJECTED':
      return 'Ditolak Otomatis'
    default:
      return evt
  }
}

function formatAudience(aud: string) {
  switch (aud) {
    case 'APPROVER':
      return 'Approver'
    case 'REQUESTER':
      return 'Pemohon'
    case 'ADMIN':
      return 'Administrator'
    case 'HR':
      return 'HR / SDM'
    default:
      return aud
  }
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Header Navigasi -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <NuxtLink to="/admin" class="hover:text-brand-600 transition-colors flex items-center gap-1">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Dasbor Admin
          </NuxtLink>
          <span>/</span>
          <span class="text-slate-700">Template Notifikasi</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
          Template & Notifikasi Otomatis
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 sm:text-sm">
          Kelola pesan Email dan Telegram untuk approver, pemohon, serta audit riwayat pengiriman.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink
          to="/admin/notifikasi/log"
          class="btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
        >
          <svg class="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Log Antrean
        </NuxtLink>
        <NuxtLink
          to="/admin/notifikasi/baru"
          class="btn-primary text-xs sm:text-sm flex items-center gap-1.5"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Template Khusus
        </NuxtLink>
      </div>
    </div>

    <!-- Ringkasan Statistik -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="card p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Template</div>
        <div class="mt-2 text-2xl font-black text-slate-900">{{ countTotal }}</div>
        <div class="mt-1 text-xs text-slate-400">Tersedia dalam sistem</div>
      </div>
      <div class="card p-4 border-l-4 border-l-blue-500">
        <div class="text-xs font-semibold uppercase tracking-wider text-blue-600">Email</div>
        <div class="mt-2 text-2xl font-black text-slate-900">{{ countEmail }}</div>
        <div class="mt-1 text-xs text-slate-400">Layout HTML responsif</div>
      </div>
      <div class="card p-4 border-l-4 border-l-sky-500">
        <div class="text-xs font-semibold uppercase tracking-wider text-sky-600">Telegram</div>
        <div class="mt-2 text-2xl font-black text-slate-900">{{ countTelegram }}</div>
        <div class="mt-1 text-xs text-slate-400">Bot instant message</div>
      </div>
      <div class="card p-4 border-l-4 border-l-amber-500">
        <div class="text-xs font-semibold uppercase tracking-wider text-amber-600">Template Khusus</div>
        <div class="mt-2 text-2xl font-black text-slate-900">{{ countCustom }}</div>
        <div class="mt-1 text-xs text-slate-400">Scoped per izin/step</div>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="card p-4 space-y-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <!-- Search -->
        <div class="relative flex-1">
          <input
            v-model="search"
            type="text"
            placeholder="Cari template (nama, kode, subjek)..."
            class="input-text w-full pl-9 text-xs sm:text-sm"
          />
          <svg class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <!-- Kanal Filter -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500">Kanal:</span>
          <div class="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              type="button"
              :class="selectedChannel === 'ALL' ? 'bg-white shadow-xs font-bold text-slate-800' : 'text-slate-500 hover:text-slate-700'"
              class="px-2.5 py-1 text-xs rounded-md transition-all"
              @click="selectedChannel = 'ALL'"
            >
              Semua
            </button>
            <button
              type="button"
              :class="selectedChannel === 'EMAIL' ? 'bg-white shadow-xs font-bold text-blue-600' : 'text-slate-500 hover:text-slate-700'"
              class="px-2.5 py-1 text-xs rounded-md transition-all"
              @click="selectedChannel = 'EMAIL'"
            >
              Email
            </button>
            <button
              type="button"
              :class="selectedChannel === 'TELEGRAM' ? 'bg-white shadow-xs font-bold text-sky-600' : 'text-slate-500 hover:text-slate-700'"
              class="px-2.5 py-1 text-xs rounded-md transition-all"
              @click="selectedChannel = 'TELEGRAM'"
            >
              Telegram
            </button>
          </div>
        </div>

        <!-- Audience Filter -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500">Target:</span>
          <select v-model="selectedAudience" class="input-select text-xs py-1">
            <option value="ALL">Semua Target</option>
            <option value="APPROVER">Approver</option>
            <option value="REQUESTER">Pemohon</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Template List Grouped by Event -->
    <div v-if="pending" class="card p-8 text-center text-xs text-slate-400">
      Memuat daftar template notifikasi...
    </div>

    <div v-else-if="filteredTemplates.length === 0" class="card p-8 text-center">
      <svg class="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <div class="mt-3 text-sm font-semibold text-slate-700">Tidak ada template ditemukan</div>
      <p class="text-xs text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter kanal.</p>
    </div>

    <div v-else class="space-y-6">
      <div
        v-for="(groupItems, eventTypeKey) in groupedTemplates"
        :key="eventTypeKey"
        class="space-y-3"
      >
        <!-- Group Header -->
        <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
          <div class="h-2 w-2 rounded-full bg-brand-600"></div>
          <h2 class="text-sm font-bold text-slate-800">
            {{ formatEventName(String(eventTypeKey)) }}
          </h2>
          <span class="text-xs text-slate-400">({{ groupItems.length }} template)</span>
        </div>

        <!-- Cards in Group -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            v-for="tpl in groupItems"
            :key="tpl.id"
            class="card p-4 hover:border-slate-300 transition-all flex flex-col justify-between group"
          >
            <div>
              <!-- Badges Header -->
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <!-- Channel Badge -->
                  <span
                    v-if="tpl.channel === 'EMAIL'"
                    class="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100"
                  >
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 border border-sky-100"
                  >
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Telegram
                  </span>

                  <!-- Target Audience Badge -->
                  <span class="badge bg-slate-100 text-slate-700 text-[11px]">
                    {{ formatAudience(tpl.target_audience) }}
                  </span>

                  <!-- Default or Scoped Badge -->
                  <span
                    v-if="tpl.is_default"
                    class="badge bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px]"
                  >
                    Bawaan Sistem
                  </span>
                  <span
                    v-else
                    class="badge bg-amber-50 text-amber-700 border border-amber-100 text-[11px]"
                  >
                    Khusus
                  </span>
                </div>

                <span
                  :class="tpl.is_active ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'"
                  class="text-[10px] font-bold px-1.5 py-0.5 rounded"
                >
                  {{ tpl.is_active ? 'Aktif' : 'Nonaktif' }}
                </span>
              </div>

              <!-- Template Title & Code -->
              <h3 class="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                {{ tpl.name }}
              </h3>
              <div class="text-[11px] font-mono text-slate-400 mt-0.5">
                {{ tpl.code }}
              </div>

              <!-- Scope details if custom -->
              <div v-if="tpl.leave_type_name || tpl.workflow_step_name || tpl.employee_name" class="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-md">
                <span class="font-semibold">Cakupan Khusus:</span>
                <span v-if="tpl.leave_type_name"> Jenis Izin: {{ tpl.leave_type_name }}</span>
                <span v-if="tpl.workflow_step_name"> | Tahap: {{ tpl.workflow_step_name }}</span>
                <span v-if="tpl.employee_name"> | Pegawai: {{ tpl.employee_name }}</span>
              </div>

              <!-- Subject / Snippet Preview -->
              <div class="mt-2 text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                <span v-if="tpl.subject_template" class="font-bold block text-slate-800">{{ tpl.subject_template }}</span>
                <span class="text-slate-500 whitespace-pre-line">{{ tpl.body_template }}</span>
              </div>
            </div>

            <!-- Card Footer -->
            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span class="text-[10px] text-slate-400">
                Format: <span class="font-semibold uppercase">{{ tpl.parse_mode }}</span>
              </span>
              <NuxtLink
                :to="`/admin/notifikasi/${tpl.id}`"
                class="btn-secondary text-xs py-1 px-3 flex items-center gap-1 font-semibold group-hover:border-brand-300"
              >
                <span>Kustomisasi</span>
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
