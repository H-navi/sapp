<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Riwayat Persetujuan · Sistem Perizinan Pegawai',
})

const activeTab = ref<'all' | 'APPROVED' | 'REJECTED'>('all')

const { data: res, pending, refresh } = await useFetch<{ data: any[] }>('/api/approvals/history')
const history = computed(() => res.value?.data ?? [])

const filteredList = computed(() => {
  if (activeTab.value === 'all') return history.value
  return history.value.filter((h) => h.response === activeTab.value)
})

const countApproved = computed(() => history.value.filter((h) => h.response === 'APPROVED').length)
const countRejected = computed(() => history.value.filter((h) => h.response === 'REJECTED').length)

function formatDate(d: string | null | undefined) {
  if (!d) return '-'
  return dayjs(d).format('D MMM YYYY')
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return '-'
  return dayjs(d).format('D MMM YYYY, HH:mm')
}
</script>

<template>
  <div class="space-y-5 pb-12">
    <!-- Header Halaman -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <NuxtLink to="/approval" class="hover:text-brand-600 transition-colors flex items-center gap-1">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Kotak Masuk
          </NuxtLink>
          <span>/</span>
          <span class="text-slate-700">Riwayat</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
          Riwayat Tugas Persetujuan
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 sm:text-sm">
          Daftar seluruh keputusan persetujuan maupun penolakan yang telah Anda lakukan.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5"
          :disabled="pending"
          @click="() => refresh()"
        >
          <svg
            class="h-4 w-4"
            :class="{ 'animate-spin': pending }"
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

    <!-- Filter Tab Chips -->
    <div class="flex items-center gap-2 text-xs">
      <button
        type="button"
        class="px-3.5 py-2 rounded-lg font-semibold transition"
        :class="activeTab === 'all' ? 'bg-brand-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'"
        @click="activeTab = 'all'"
      >
        Semua ({{ history.length }})
      </button>

      <button
        type="button"
        class="px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-1.5"
        :class="activeTab === 'APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'"
        @click="activeTab = 'APPROVED'"
      >
        <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
        Disetujui ({{ countApproved }})
      </button>

      <button
        type="button"
        class="px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-1.5"
        :class="activeTab === 'REJECTED' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'"
        @click="activeTab = 'REJECTED'"
      >
        <span class="h-2 w-2 rounded-full bg-rose-400"></span>
        Ditolak ({{ countRejected }})
      </button>
    </div>

    <!-- State Memuat -->
    <div v-if="pending && history.length === 0" class="card p-10 text-center text-slate-400 text-sm">
      <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent mb-2"></div>
      <p>Memuat riwayat persetujuan...</p>
    </div>

    <!-- State Kosong -->
    <div v-else-if="filteredList.length === 0" class="card p-10 text-center space-y-2">
      <p class="text-sm font-semibold text-slate-700">Belum Ada Riwayat</p>
      <p class="text-xs text-slate-400">
        Tugas persetujuan yang telah Anda selesaikan akan dicatat dan ditampilkan di sini.
      </p>
    </div>

    <!-- Daftar Riwayat -->
    <div v-else class="space-y-3">
      <div
        v-for="item in filteredList"
        :key="item.taskId"
        class="card p-4 sm:p-5 space-y-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="badge font-bold text-xs"
                :class="item.response === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
              >
                {{ item.response === 'APPROVED' ? 'Disetujui' : 'Ditolak' }}
              </span>

              <span
                class="badge text-white font-semibold text-[11px]"
                :style="{ backgroundColor: item.leaveTypeColor || '#64748b' }"
              >
                {{ item.leaveTypeName }}
              </span>

              <span class="text-[11px] font-mono text-slate-400">
                #{{ item.requestNumber }}
              </span>
            </div>

            <h3 class="text-base font-bold text-slate-900 pt-1">
              {{ item.requesterName }}
            </h3>
            <p class="text-xs text-slate-500">
              {{ item.departmentName || 'Divisi Pegawai' }} · {{ item.totalDays }} hari kalender
            </p>
          </div>

          <div class="text-right text-xs text-slate-500 flex-shrink-0">
            <p class="font-medium text-slate-700">{{ formatDateTime(item.respondedAt) }}</p>
            <p class="text-[11px] text-slate-400 mt-0.5">{{ item.stepName }}</p>
          </div>
        </div>

        <!-- Periode Tanggal -->
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>
            Periode: <strong>{{ formatDate(item.startDate) }}</strong> s.d. <strong>{{ formatDate(item.endDate) }}</strong>
          </span>

          <NuxtLink
            :to="`/approval/${item.taskId}`"
            class="text-brand-600 hover:text-brand-700 font-semibold text-xs flex items-center gap-1"
          >
            Lihat Detail
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>

        <!-- Catatan Respon jika ada -->
        <div v-if="item.responseNote" class="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-600 border border-slate-100">
          <span class="font-semibold text-slate-700">Catatan Anda:</span>
          <p class="mt-0.5 italic">"{{ item.responseNote }}"</p>
        </div>
      </div>
    </div>
  </div>
</template>
