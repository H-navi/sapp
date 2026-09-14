<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Log Antrean & Pengiriman Notifikasi · Admin',
})

const route = useRoute()
const search = ref('')
const selectedStatus = ref('ALL')
const selectedChannel = ref('ALL')
const page = ref(1)
const limit = ref(20)

// Fetch logs
const { data: res, pending, refresh } = await useFetch('/api/admin/notifications/logs', {
  query: computed(() => ({
    search: search.value || undefined,
    status: selectedStatus.value !== 'ALL' ? selectedStatus.value : undefined,
    channel: selectedChannel.value !== 'ALL' ? selectedChannel.value : undefined,
    page: page.value,
    limit: limit.value,
  })),
  watch: [search, selectedStatus, selectedChannel, page],
})

const logs = computed(() => res.value?.data ?? [])
const pagination = computed(() => res.value?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 })
const stats = computed(() => res.value?.stats ?? { total_24h: 0, sent_24h: 0, queued_24h: 0, failed_24h: 0 })

// Modal inspection state
const selectedLog = ref<any | null>(null)
const isRetrying = ref<string | null>(null)
const toastText = ref('')

function showToast(msg: string) {
  toastText.value = msg
  setTimeout(() => {
    toastText.value = ''
  }, 4000)
}

function formatDate(val: string | null) {
  if (!val) return '-'
  return dayjs(val).format('D MMM YYYY HH:mm')
}

async function retryNotification(logId: string) {
  isRetrying.value = logId
  try {
    const res = await $fetch<{ success: boolean; message: string }>(`/api/admin/notifications/logs/${logId}/retry`, {
      method: 'POST',
    })
    showToast(res.message || 'Notifikasi berhasil dijadwalkan ulang.')
    await refresh()
    if (selectedLog.value && selectedLog.value.id === logId) {
      selectedLog.value = null
    }
  } catch (err: any) {
    showToast(err?.data?.message || err?.message || 'Gagal menjadwalkan ulang notifikasi.')
  } finally {
    isRetrying.value = null
  }
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Toast Feedback -->
    <div
      v-if="toastText"
      class="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 text-white px-4 py-3 shadow-xl text-xs sm:text-sm font-medium flex items-center gap-3"
    >
      <span>{{ toastText }}</span>
      <button type="button" class="text-slate-400 hover:text-white" @click="toastText = ''">✕</button>
    </div>

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
          <span class="text-slate-700">Log Antrean</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
          Audit & Antrean Pengiriman Notifikasi
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 sm:text-sm">
          Pantau status antrean, pengiriman Email dan Telegram, serta investigasi kegagalan provider.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="pending"
          class="btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
          @click="refresh()"
        >
          <svg
            :class="{ 'animate-spin': pending }"
            class="h-4 w-4 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Segarkan
        </button>
      </div>
    </div>

    <!-- 24-Hour Summary Stat Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="card p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Pesan 24 Jam</div>
        <div class="mt-2 text-2xl font-black text-slate-900">{{ stats.total_24h }}</div>
        <div class="mt-1 text-xs text-slate-400">Total aktivitas</div>
      </div>
      <div class="card p-4 border-l-4 border-l-emerald-500">
        <div class="text-xs font-semibold uppercase tracking-wider text-emerald-600">Berhasil Terkirim</div>
        <div class="mt-2 text-2xl font-black text-slate-900">{{ stats.sent_24h }}</div>
        <div class="mt-1 text-xs text-slate-400">Status SENT</div>
      </div>
      <div class="card p-4 border-l-4 border-l-amber-500">
        <div class="text-xs font-semibold uppercase tracking-wider text-amber-600">Dalam Antrean</div>
        <div class="mt-2 text-2xl font-black text-slate-900">{{ stats.queued_24h }}</div>
        <div class="mt-1 text-xs text-slate-400">Menunggu giliran kirim</div>
      </div>
      <div class="card p-4 border-l-4 border-l-rose-500">
        <div class="text-xs font-semibold uppercase tracking-wider text-rose-600">Gagal Terkirim</div>
        <div class="mt-2 text-2xl font-black text-slate-900">{{ stats.failed_24h }}</div>
        <div class="mt-1 text-xs text-slate-400">Dapat dijadwalkan ulang</div>
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
            placeholder="Cari penerima, email, chat ID, atau subjek..."
            class="input-text w-full pl-9 text-xs sm:text-sm"
          />
          <svg class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <!-- Status Filter -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500">Status:</span>
          <select v-model="selectedStatus" class="input-select text-xs py-1">
            <option value="ALL">Semua Status</option>
            <option value="QUEUED">Antrean (QUEUED)</option>
            <option value="SENDING">Mengirim (SENDING)</option>
            <option value="SENT">Terkirim (SENT)</option>
            <option value="FAILED">Gagal (FAILED)</option>
          </select>
        </div>

        <!-- Channel Filter -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500">Kanal:</span>
          <select v-model="selectedChannel" class="input-select text-xs py-1">
            <option value="ALL">Semua Kanal</option>
            <option value="EMAIL">Email</option>
            <option value="TELEGRAM">Telegram</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Log Table -->
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs sm:text-sm">
          <thead class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-3">Waktu</th>
              <th class="px-4 py-3">Kanal</th>
              <th class="px-4 py-3">Penerima</th>
              <th class="px-4 py-3">Subjek / Isi</th>
              <th class="px-4 py-3 text-center">Status</th>
              <th class="px-4 py-3 text-center">Percobaan</th>
              <th class="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="pending" class="text-center text-slate-400">
              <td colspan="7" class="py-8">Memuat riwayat pengiriman...</td>
            </tr>
            <tr v-else-if="logs.length === 0" class="text-center text-slate-400">
              <td colspan="7" class="py-8">Tidak ada notifikasi dalam filter ini.</td>
            </tr>
            <tr
              v-for="item in logs"
              :key="item.id"
              class="hover:bg-slate-50 transition-colors"
            >
              <!-- Waktu -->
              <td class="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                <div>{{ formatDate(item.created_at) }}</div>
                <div v-if="item.sent_at" class="text-[10px] text-emerald-600 font-medium">
                  Kirim: {{ formatDate(item.sent_at) }}
                </div>
              </td>

              <!-- Kanal -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  v-if="item.channel === 'EMAIL'"
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
              </td>

              <!-- Penerima -->
              <td class="px-4 py-3">
                <div class="font-semibold text-slate-800">{{ item.recipient_name || 'Tanpa Nama' }}</div>
                <div class="text-xs text-slate-500 font-mono">{{ item.recipient_address }}</div>
              </td>

              <!-- Subjek / Snippet -->
              <td class="px-4 py-3 max-w-xs">
                <div v-if="item.subject" class="font-semibold text-slate-800 line-clamp-1">
                  {{ item.subject }}
                </div>
                <div class="text-xs text-slate-500 line-clamp-1 font-mono">
                  {{ item.body }}
                </div>
              </td>

              <!-- Status -->
              <td class="px-4 py-3 text-center whitespace-nowrap">
                <span
                  v-if="item.status === 'SENT'"
                  class="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"
                >
                  SENT
                </span>
                <span
                  v-else-if="item.status === 'QUEUED'"
                  class="badge bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold"
                >
                  QUEUED
                </span>
                <span
                  v-else-if="item.status === 'SENDING'"
                  class="badge bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold"
                >
                  SENDING
                </span>
                <span
                  v-else
                  class="badge bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold"
                  :title="item.error_message || 'Gagal kirim'"
                >
                  FAILED
                </span>
              </td>

              <!-- Percobaan -->
              <td class="px-4 py-3 text-center whitespace-nowrap text-xs text-slate-500">
                {{ item.attempt_count }} / {{ item.max_attempts }}
              </td>

              <!-- Aksi -->
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    class="btn-secondary text-xs py-1 px-2.5"
                    @click="selectedLog = item"
                  >
                    Detail
                  </button>
                  <button
                    v-if="item.status === 'FAILED'"
                    type="button"
                    :disabled="isRetrying === item.id"
                    class="btn-primary text-xs py-1 px-2.5 bg-amber-600 hover:bg-amber-700 border-amber-600"
                    @click="retryNotification(item.id)"
                  >
                    {{ isRetrying === item.id ? 'Memproses...' : 'Kirim Ulang' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div v-if="pagination.totalPages > 1" class="border-t border-slate-100 p-4 flex items-center justify-between text-xs text-slate-500">
        <div>
          Menampilkan halaman {{ pagination.page }} dari {{ pagination.totalPages }} (Total {{ pagination.total }} pesan)
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            :disabled="pagination.page <= 1"
            class="btn-secondary text-xs px-2.5 py-1 disabled:opacity-50"
            @click="page--"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            :disabled="pagination.page >= pagination.totalPages"
            class="btn-secondary text-xs px-2.5 py-1 disabled:opacity-50"
            @click="page++"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Inspection Modal -->
    <div
      v-if="selectedLog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      @click.self="selectedLog = null"
    >
      <div class="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-base font-bold text-slate-900">Detail Pesan Notifikasi</h3>
            <p class="text-xs text-slate-400 font-mono">{{ selectedLog.id }}</p>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-700 text-lg font-bold"
            @click="selectedLog = null"
          >
            ✕
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span class="text-slate-400 block">Kanal:</span>
            <span class="font-bold text-slate-800">{{ selectedLog.channel }}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Status:</span>
            <span class="font-bold uppercase text-slate-800">{{ selectedLog.status }}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Penerima:</span>
            <span class="font-semibold text-slate-800">{{ selectedLog.recipient_name || '-' }} ({{ selectedLog.recipient_address }})</span>
          </div>
          <div>
            <span class="text-slate-400 block">Percobaan:</span>
            <span class="font-semibold text-slate-800">{{ selectedLog.attempt_count }} dari {{ selectedLog.max_attempts }}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Dijadwalkan:</span>
            <span class="text-slate-700">{{ formatDate(selectedLog.scheduled_at) }}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Waktu Terkirim:</span>
            <span class="text-slate-700">{{ formatDate(selectedLog.sent_at) }}</span>
          </div>
          <div v-if="selectedLog.provider_message_id" class="col-span-2">
            <span class="text-slate-400 block">Provider Message ID:</span>
            <code class="text-slate-700 font-mono text-[11px]">{{ selectedLog.provider_message_id }}</code>
          </div>
        </div>

        <!-- Error Message if failed -->
        <div v-if="selectedLog.error_message" class="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900">
          <div class="font-bold flex items-center gap-1 mb-1">
            <svg class="h-4 w-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pesan Kesalahan Provider
          </div>
          <code class="text-rose-800 break-all whitespace-pre-wrap">{{ selectedLog.error_message }}</code>
        </div>

        <!-- Subject -->
        <div v-if="selectedLog.subject">
          <div class="text-xs font-semibold text-slate-600 mb-1">Subjek:</div>
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded font-medium text-xs text-slate-900">
            {{ selectedLog.subject }}
          </div>
        </div>

        <!-- Full Body -->
        <div>
          <div class="text-xs font-semibold text-slate-600 mb-1">Isi Pesan Terender:</div>
          <pre class="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 whitespace-pre-wrap font-mono max-h-56 overflow-y-auto leading-relaxed">{{ selectedLog.body }}</pre>
        </div>

        <!-- Modal Actions -->
        <div class="border-t border-slate-100 pt-3 flex items-center justify-between">
          <button
            type="button"
            class="btn-secondary text-xs"
            @click="selectedLog = null"
          >
            Tutup
          </button>
          <button
            v-if="selectedLog.status === 'FAILED'"
            type="button"
            :disabled="isRetrying === selectedLog.id"
            class="btn-primary text-xs bg-amber-600 hover:bg-amber-700 border-amber-600"
            @click="retryNotification(selectedLog.id)"
          >
            {{ isRetrying === selectedLog.id ? 'Memproses...' : 'Kirim Ulang Sekarang' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
