<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Penjadwal & Otomasi Sistem · Admin',
})

const { data: res, pending, refresh } = await useFetch<{ data: { jobs: any[]; executionLogs: any[] } }>('/api/admin/scheduler/jobs')

const jobs = computed(() => res.value?.data?.jobs ?? [])
const executionLogs = computed(() => res.value?.data?.executionLogs ?? [])

const selectedJobFilter = ref<string>('ALL')
const triggeringJob = ref<string | null>(null)
const actionMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const selectedDetailLog = ref<any | null>(null)

const filteredLogs = computed(() => {
  if (selectedJobFilter.value === 'ALL') return executionLogs.value
  return executionLogs.value.filter((l) => l.jobName === selectedJobFilter.value)
})

async function triggerJob(jobId: string) {
  triggeringJob.value = jobId
  actionMessage.value = null

  try {
    const resp = await $fetch<{ success: boolean; result: any }>('/api/admin/scheduler/trigger', {
      method: 'POST',
      body: { task: jobId },
    })

    const count = resp.result?.processedCount ?? 0
    actionMessage.value = {
      type: 'success',
      text: `Tugas ${jobId} berhasil dijalankan. (${count} item diproses)`,
    }
    await refresh()
  } catch (err: any) {
    actionMessage.value = {
      type: 'error',
      text: err.data?.message || err.message || 'Gagal mengeksekusi tugas.',
    }
  } finally {
    triggeringJob.value = null
  }
}

function formatDate(val: string | Date | null) {
  if (!val) return '-'
  return dayjs(val).format('DD MMM YYYY HH:mm:ss')
}

function formatDuration(ms?: number | null) {
  if (ms === undefined || ms === null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'RUNNING':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'FAILED':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    case 'SKIPPED':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <AppPageHeader
        title="Penjadwal & Otomasi Sistem"
        subtitle="Monitoring tugas latar belakang, pengingat SLA berkala, eskalasi otomatis, dan riwayat eksekusi"
      />
      <div class="flex items-center gap-2">
        <NuxtLink to="/admin" class="btn btn-secondary text-sm">
          Kembali ke Dasbor
        </NuxtLink>
        <button class="btn btn-secondary text-sm flex items-center gap-1.5" :disabled="pending" @click="refresh()">
          <svg class="h-4 w-4" :class="{ 'animate-spin': pending }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Segarkan
        </button>
      </div>
    </div>

    <!-- Alert Notification -->
    <div
      v-if="actionMessage"
      class="rounded-xl border p-4 text-sm flex items-center justify-between"
      :class="actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'"
    >
      <div class="flex items-center gap-2">
        <svg v-if="actionMessage.type === 'success'" class="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="h-5 w-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>{{ actionMessage.text }}</span>
      </div>
      <button class="text-xs font-semibold underline hover:opacity-75" @click="actionMessage = null">
        Tutup
      </button>
    </div>

    <!-- Cards: Active Tasks -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div
        v-for="job in jobs"
        :key="job.id"
        class="card p-5 flex flex-col justify-between hover:border-brand-300 transition-all shadow-sm"
      >
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 class="text-base font-bold text-slate-900">{{ job.name }}</h3>
              </div>
              <p class="text-xs font-mono text-slate-500 mt-0.5">{{ job.id }}</p>
            </div>
            <span class="badge border font-mono text-xs bg-slate-100 text-slate-700">
              {{ job.cron }}
            </span>
          </div>

          <p class="mt-3 text-xs text-slate-600 leading-relaxed">
            {{ job.description }}
          </p>

          <!-- Status run terakhir -->
          <div class="mt-4 rounded-lg bg-slate-50 p-3 text-xs border border-slate-100 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Jadwal:</span>
              <span class="font-medium text-slate-700">{{ job.intervalDescription }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Eksekusi Terakhir:</span>
              <span class="font-medium text-slate-700">
                {{ formatDate(job.lastExecution?.started_at) }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Status Terakhir:</span>
              <span
                v-if="job.lastExecution"
                class="badge border text-[11px] px-2 py-0.5"
                :class="getStatusBadge(job.lastExecution.status)"
              >
                {{ job.lastExecution.status }} ({{ job.lastExecution.processed_count }} diproses)
              </span>
              <span v-else class="text-slate-400 italic">Belum pernah dijalankan</span>
            </div>
          </div>
        </div>

        <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            class="btn btn-brand text-xs flex items-center gap-1.5"
            :disabled="triggeringJob === job.id"
            @click="triggerJob(job.id)"
          >
            <svg v-if="triggeringJob === job.id" class="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <svg v-else class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ triggeringJob === job.id ? 'Menjalankan...' : 'Jalankan Sekarang' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Execution Logs Table -->
    <div class="card overflow-hidden">
      <div class="border-b border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 class="text-base font-bold text-slate-900">Riwayat Eksekusi (Audit Log)</h3>
          <p class="text-xs text-slate-500">Mencatat 50 kali eksekusi terakhir dari seluruh tugas otomatis</p>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-slate-500">Filter Tugas:</label>
          <select v-model="selectedJobFilter" class="input py-1 text-xs w-auto">
            <option value="ALL">Semua Tugas</option>
            <option value="approval:reminder">approval:reminder</option>
            <option value="approval:escalation">approval:escalation</option>
            <option value="approval:auto-decision">approval:auto-decision</option>
            <option value="maintenance:daily">maintenance:daily</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-600">
          <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
            <tr>
              <th class="p-3">Waktu Mulai</th>
              <th class="p-3">Nama Tugas</th>
              <th class="p-3">Status</th>
              <th class="p-3 text-center">Diproses</th>
              <th class="p-3">Durasi</th>
              <th class="p-3">Pesan / Info</th>
              <th class="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="filteredLogs.length === 0">
              <td colspan="7" class="p-8 text-center text-slate-400">
                Belum ada catatan riwayat eksekusi.
              </td>
            </tr>
            <tr
              v-for="log in filteredLogs"
              :key="log.id"
              class="hover:bg-slate-50/70 transition-colors"
            >
              <td class="p-3 whitespace-nowrap font-medium text-slate-800">
                {{ formatDate(log.startedAt) }}
              </td>
              <td class="p-3 whitespace-nowrap font-mono text-slate-700">
                {{ log.jobName }}
              </td>
              <td class="p-3 whitespace-nowrap">
                <span class="badge border text-[11px] px-2 py-0.5" :class="getStatusBadge(log.status)">
                  {{ log.status }}
                </span>
              </td>
              <td class="p-3 whitespace-nowrap text-center font-semibold">
                {{ log.processedCount }}
              </td>
              <td class="p-3 whitespace-nowrap">
                {{ formatDuration(log.details?.durationMs) }}
              </td>
              <td class="p-3 max-w-xs truncate text-slate-500">
                <span v-if="log.errorMessage" class="text-rose-600 font-medium">{{ log.errorMessage }}</span>
                <span v-else-if="log.details?.message">{{ log.details.message }}</span>
                <span v-else class="text-slate-400 italic">-</span>
              </td>
              <td class="p-3 whitespace-nowrap text-right">
                <button
                  class="text-xs text-brand-600 hover:text-brand-800 font-medium"
                  @click="selectedDetailLog = log"
                >
                  Detail
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Detail Log -->
    <div
      v-if="selectedDetailLog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div class="card w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Detail Eksekusi #{{ selectedDetailLog.id }}</h3>
            <p class="text-xs font-mono text-slate-500">{{ selectedDetailLog.jobName }}</p>
          </div>
          <button class="text-slate-400 hover:text-slate-600" @click="selectedDetailLog = null">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="rounded-lg bg-slate-50 p-2.5">
            <span class="text-slate-400 block">Status:</span>
            <span class="badge border font-semibold mt-1" :class="getStatusBadge(selectedDetailLog.status)">
              {{ selectedDetailLog.status }}
            </span>
          </div>
          <div class="rounded-lg bg-slate-50 p-2.5">
            <span class="text-slate-400 block">Item Diproses:</span>
            <span class="font-bold text-slate-800 mt-1 block">{{ selectedDetailLog.processedCount }} item</span>
          </div>
          <div class="rounded-lg bg-slate-50 p-2.5">
            <span class="text-slate-400 block">Mulai:</span>
            <span class="font-medium text-slate-800 mt-1 block">{{ formatDate(selectedDetailLog.startedAt) }}</span>
          </div>
          <div class="rounded-lg bg-slate-50 p-2.5">
            <span class="text-slate-400 block">Selesai:</span>
            <span class="font-medium text-slate-800 mt-1 block">{{ formatDate(selectedDetailLog.finishedAt) }}</span>
          </div>
        </div>

        <div v-if="selectedDetailLog.errorMessage" class="rounded-lg bg-rose-50 p-3 border border-rose-200 text-xs text-rose-800">
          <span class="font-bold block mb-1">Pesan Error:</span>
          <p class="font-mono whitespace-pre-wrap">{{ selectedDetailLog.errorMessage }}</p>
        </div>

        <div>
          <span class="text-xs font-semibold text-slate-700 block mb-1">Metadata / Details:</span>
          <pre class="rounded-lg bg-slate-900 text-slate-100 p-3 text-[11px] font-mono overflow-x-auto">{{ JSON.stringify(selectedDetailLog.details, null, 2) }}</pre>
        </div>

        <div class="flex justify-end pt-2">
          <button class="btn btn-secondary text-xs" @click="selectedDetailLog = null">
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
