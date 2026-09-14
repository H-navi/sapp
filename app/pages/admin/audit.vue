<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Log Audit Sistem · Administrator',
})

const route = useRoute()
const page = ref(Number(route.query.page || 1))
const selectedEntity = ref(String(route.query.entity_type || ''))
const selectedAction = ref(String(route.query.action || ''))
const search = ref(String(route.query.search || ''))
const fromDate = ref(String(route.query.from || ''))
const toDate = ref(String(route.query.to || ''))

// Fetch Audit Logs
const queryParams = computed(() => ({
  page: page.value,
  limit: 20,
  entity_type: selectedEntity.value || undefined,
  action: selectedAction.value || undefined,
  search: search.value || undefined,
  from: fromDate.value || undefined,
  to: toDate.value || undefined,
}))

const { data: res, pending, refresh } = await useFetch<{
  data: any[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  meta: { entityTypes: string[]; actions: string[] }
}>('/api/admin/audit', {
  query: queryParams,
})

const logs = computed(() => res.value?.data || [])
const pagination = computed(() => res.value?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 })
const filterMeta = computed(() => res.value?.meta || { entityTypes: [], actions: [] })

function formatDate(d?: string | null) {
  if (!d) return '-'
  return dayjs(d).format('D MMM YYYY, HH:mm:ss [WIB]')
}

function getRelativeTime(d?: string | null) {
  if (!d) return '-'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} mnt lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  return dayjs(d).format('D MMM YYYY')
}

function getActionBadge(action: string) {
  const upper = action.toUpperCase()
  if (upper.includes('CREATE') || upper.includes('INSERT')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (upper.includes('DELETE') || upper.includes('REMOVE')) {
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }
  if (upper.includes('OVERRIDE') || upper.includes('INTERVENTION')) {
    return 'bg-amber-50 text-amber-800 border-amber-300'
  }
  if (upper.includes('LOGIN')) {
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

// Helper untuk mengekstrak pasangan diff (nilai lama -> nilai baru)
function getDiffPairs(oldVal: any, newVal: any) {
  const pairs: Array<{ key: string; oldV: any; newV: any }> = []

  const oldObj = oldVal && typeof oldVal === 'object' ? oldVal : {}
  const newObj = newVal && typeof newVal === 'object' ? newVal : {}

  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]))

  for (const key of allKeys) {
    const o = oldObj[key]
    const n = newObj[key]
    // Tampilkan jika nilainya berbeda atau salah satunya undefined
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      pairs.push({ key, oldV: o, newV: n })
    }
  }

  return pairs
}

function formatVal(val: any): string {
  if (val === undefined || val === null) return '—'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

// Modal Detail JSON Mentah
const selectedLogForJson = ref<any | null>(null)
</script>

<template>
  <div class="space-y-6 pb-16">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span class="w-3 h-3 rounded-full bg-slate-800"></span>
          Jejak Audit Konfigurasi & Sistem
        </h1>
        <p class="text-xs text-slate-500 mt-1">
          Rekaman seluruh aktivitas administratif, perubahan konfigurasi, dan intervensi alur.
        </p>
      </div>

      <NuxtLink
        to="/admin"
        class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
      >
        &larr; Dasbor Admin
      </NuxtLink>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <!-- Search -->
        <div class="md:col-span-2">
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Cari Pelaku / Entitas</label>
          <input
            v-model="search"
            type="text"
            placeholder="Ketik nama, username, atau aksi..."
            class="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            @keyup.enter="page = 1"
          />
        </div>

        <!-- Entity Type -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Entitas</label>
          <select
            v-model="selectedEntity"
            class="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            @change="page = 1"
          >
            <option value="">Semua Entitas</option>
            <option v-for="e in filterMeta.entityTypes" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>

        <!-- Action -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Aksi</label>
          <select
            v-model="selectedAction"
            class="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            @change="page = 1"
          >
            <option value="">Semua Aksi</option>
            <option v-for="a in filterMeta.actions" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>

        <!-- From Date -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal Mulai</label>
          <input
            v-model="fromDate"
            type="date"
            class="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            @change="page = 1"
          />
        </div>
      </div>
    </div>

    <!-- Table List -->
    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <!-- Loading State -->
      <div v-if="pending" class="p-12 text-center text-slate-400 text-sm">
        <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        Memuat jejak audit...
      </div>

      <!-- Empty State -->
      <div v-else-if="logs.length === 0" class="p-12 text-center text-slate-500 text-xs">
        Tidak ada catatan audit yang cocok dengan filter.
      </div>

      <!-- Audit Items Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
            <tr>
              <th class="py-3 px-4">Waktu</th>
              <th class="py-3 px-4">Pelaku</th>
              <th class="py-3 px-4">Aksi & Entitas</th>
              <th class="py-3 px-4">Perubahan (Nilai Lama &rarr; Nilai Baru)</th>
              <th class="py-3 px-4 text-right">Detail</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="l in logs"
              :key="l.id"
              class="hover:bg-slate-50/70 transition-colors align-top"
            >
              <!-- Time -->
              <td class="py-3.5 px-4 whitespace-nowrap">
                <div class="font-bold text-slate-800">{{ getRelativeTime(l.createdAt) }}</div>
                <div class="text-[11px] text-slate-400 mt-0.5" :title="formatDate(l.createdAt)">
                  {{ formatDate(l.createdAt) }}
                </div>
              </td>

              <!-- Actor -->
              <td class="py-3.5 px-4 whitespace-nowrap">
                <div class="font-semibold text-slate-900">
                  {{ l.actorFullName || l.actorUsername || 'Sistem' }}
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                    {{ l.actorType }}
                  </span>
                  <span v-if="l.ipAddress" class="font-mono text-slate-400">{{ l.ipAddress }}</span>
                </div>
              </td>

              <!-- Action & Entity -->
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span
                  class="inline-block px-2 py-0.5 rounded text-[11px] font-bold border"
                  :class="getActionBadge(l.action)"
                >
                  {{ l.action }}
                </span>
                <div class="text-[11px] text-slate-500 font-mono mt-1">
                  {{ l.entityType }} <span v-if="l.entityId" class="text-slate-400 text-[10px]">({{ String(l.entityId).substring(0, 8) }}...)</span>
                </div>
              </td>

              <!-- Clean Diff (Old Value -> New Value) -->
              <td class="py-3.5 px-4 max-w-md">
                <div v-if="getDiffPairs(l.oldValues, l.newValues).length > 0" class="space-y-1.5">
                  <div
                    v-for="pair in getDiffPairs(l.oldValues, l.newValues).slice(0, 4)"
                    :key="pair.key"
                    class="text-[11px] bg-slate-50 rounded-lg p-1.5 border border-slate-100"
                  >
                    <span class="font-mono font-bold text-slate-700">{{ pair.key }}: </span>
                    <span class="line-through text-rose-600 bg-rose-50 px-1 rounded mr-1">
                      {{ formatVal(pair.oldV) }}
                    </span>
                    <span class="text-slate-400">&rarr;</span>
                    <span class="text-emerald-700 font-semibold bg-emerald-50 px-1 rounded ml-1">
                      {{ formatVal(pair.newV) }}
                    </span>
                  </div>

                  <div v-if="getDiffPairs(l.oldValues, l.newValues).length > 4" class="text-[10px] text-slate-400 italic">
                    +{{ getDiffPairs(l.oldValues, l.newValues).length - 4 }} perubahan atribut lainnya
                  </div>
                </div>

                <div v-else-if="l.newValues" class="text-[11px] text-slate-500 italic">
                  Data baru disimpan / tidak ada pembanding lama
                </div>

                <div v-else class="text-[11px] text-slate-400">
                  —
                </div>
              </td>

              <!-- Detail Button -->
              <td class="py-3.5 px-4 text-right whitespace-nowrap">
                <button
                  type="button"
                  class="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold transition"
                  @click="selectedLogForJson = l"
                >
                  Lihat JSON
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="pagination.totalPages > 1"
        class="flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500"
      >
        <div>
          Menampilkan {{ logs.length }} dari {{ pagination.total }} jejak audit
        </div>

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            :disabled="pagination.page <= 1"
            @click="page = Math.max(1, page - 1)"
          >
            &larr; Prev
          </button>
          <span class="px-2 font-medium text-slate-700">
            Hal {{ pagination.page }} / {{ pagination.totalPages }}
          </span>
          <button
            type="button"
            class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            :disabled="pagination.page >= pagination.totalPages"
            @click="page = Math.min(pagination.totalPages, page + 1)"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL JSON DETAIL -->
    <Teleport to="body">
      <div
        v-if="selectedLogForJson"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      >
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="font-bold text-slate-900 text-base">
                Detail Log Audit #{{ selectedLogForJson.id }}
              </h3>
              <p class="text-xs text-slate-500">{{ selectedLogForJson.action }} pada {{ selectedLogForJson.entityType }}</p>
            </div>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 text-sm p-1"
              @click="selectedLogForJson = null"
            >
              ✕
            </button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            <div>
              <span class="font-bold text-slate-700 block mb-1">Nilai Lama (Old Values):</span>
              <pre class="bg-slate-900 text-slate-100 p-3 rounded-xl overflow-x-auto font-mono text-[11px] leading-relaxed">{{ JSON.stringify(selectedLogForJson.oldValues, null, 2) || 'null' }}</pre>
            </div>

            <div>
              <span class="font-bold text-slate-700 block mb-1">Nilai Baru (New Values):</span>
              <pre class="bg-slate-900 text-slate-100 p-3 rounded-xl overflow-x-auto font-mono text-[11px] leading-relaxed">{{ JSON.stringify(selectedLogForJson.newValues, null, 2) || 'null' }}</pre>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 text-right">
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              @click="selectedLogForJson = null"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
