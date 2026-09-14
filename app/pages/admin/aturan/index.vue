<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Aturan & Kebijakan Perizinan · Admin',
})

const { data: res, pending, refresh } = await useFetch<{ data: any[] }>('/api/admin/policies')
const policies = computed(() => res.value?.data ?? [])

// Total aturan aktif di seluruh kebijakan
const totalActiveRules = computed(() => {
  return policies.value.reduce((acc, p) => acc + (p.rulesCount || 0), 0)
})

function formatAction(action: string) {
  switch (action) {
    case 'AUTO_APPROVE':
      return 'Setujui Otomatis'
    case 'AUTO_REJECT':
      return 'Tolak Otomatis'
    case 'ESCALATE_NEXT_STEP':
      return 'Eskalasi ke Atasan Berikutnya'
    case 'ESCALATE_TO_STEP':
      return 'Eskalasi ke Langkah Tertentu'
    case 'NOTIFY_ADMIN_ONLY':
      return 'Notifikasi Admin'
    default:
      return 'Tunggu Tindakan'
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
          <span class="text-slate-700">Aturan Kebijakan</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
          Mesin Aturan & Kebijakan Perizinan
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 sm:text-sm">
          Kelola 20 jenis parameter validasi murni, batas jam evaluasi, dan versi kebijakan per jenis izin.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
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
          Segarkan Data
        </button>
      </div>
    </div>

    <!-- Ringkasan Statistik -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="card p-4">
        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Jenis Izin</p>
        <p class="mt-1 text-2xl font-black text-slate-900">{{ policies.length }}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Terkonfigurasi</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Aturan Aktif</p>
        <p class="mt-1 text-2xl font-black text-emerald-600">{{ totalActiveRules }}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Berjalan di sistem</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mesin Evaluasi</p>
        <p class="mt-1 text-2xl font-black text-brand-600">20 / 20</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Evaluator murni siap</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mode Eksekusi</p>
        <p class="mt-1 text-lg font-black text-indigo-600 truncate">Fail-Safe</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Aman dari auto-approve cacat</p>
      </div>
    </div>

    <!-- Daftar Kebijakan -->
    <div class="card overflow-hidden shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3 sm:px-6 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-slate-900">Kebijakan Perizinan & Batas Evaluasi</h2>
          <p class="text-xs text-slate-500">Pilih jenis izin untuk mengonfigurasi aturan atau membuat versi baru</p>
        </div>
      </div>

      <div v-if="pending && policies.length === 0" class="p-8 text-center text-slate-400 text-sm">
        <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent mb-2"></div>
        <p>Memuat kebijakan perizinan...</p>
      </div>

      <div v-else-if="policies.length === 0" class="p-8 text-center text-slate-400 text-sm">
        Belum ada kebijakan perizinan yang terdaftar.
      </div>

      <!-- Tampilan Tabel (Desktop) -->
      <div v-else class="hidden md:block overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th class="px-5 py-3.5 font-semibold">Jenis Izin</th>
              <th class="px-5 py-3.5 font-semibold">Kebijakan Aktif</th>
              <th class="px-5 py-3.5 font-semibold">Masa Berlaku</th>
              <th class="px-5 py-3.5 font-semibold">Batas Evaluasi</th>
              <th class="px-5 py-3.5 font-semibold text-center">Aturan Aktif</th>
              <th class="px-5 py-3.5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="item in policies"
              :key="item.id"
              class="hover:bg-slate-50/80 transition-colors"
            >
              <td class="px-5 py-4 font-semibold text-slate-900">
                <div class="flex items-center gap-2.5">
                  <span
                    class="h-3 w-3 rounded-full flex-shrink-0"
                    :style="{ backgroundColor: item.leaveTypeColor || '#64748B' }"
                  ></span>
                  <div>
                    <p class="font-bold text-slate-900">{{ item.leaveTypeName }}</p>
                    <p class="text-[10px] font-mono text-slate-400 uppercase">{{ item.leaveTypeCode }}</p>
                  </div>
                </div>
              </td>

              <td class="px-5 py-4">
                <p class="font-medium text-slate-900">{{ item.name }}</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="badge bg-slate-100 text-slate-700 text-[10px]">v{{ item.version }}</span>
                  <span
                    v-if="item.isActive"
                    class="badge bg-emerald-50 text-emerald-700 text-[10px]"
                  >
                    Aktif
                  </span>
                  <span
                    v-else
                    class="badge bg-rose-50 text-rose-700 text-[10px]"
                  >
                    Nonaktif
                  </span>
                </div>
              </td>

              <td class="px-5 py-4 text-slate-600">
                <p class="text-xs">
                  {{ dayjs(item.effectiveFrom).format('D MMM YYYY') }}
                  <span class="text-slate-400">s.d.</span>
                  {{ item.effectiveTo ? dayjs(item.effectiveTo).format('D MMM YYYY') : 'Sekarang' }}
                </p>
              </td>

              <td class="px-5 py-4">
                <p class="font-semibold text-slate-900">{{ Number(item.overallDeadlineHours) }} jam</p>
                <p class="text-[11px] text-slate-500">
                  {{ formatAction(item.onDeadlineAction) }}
                  <span v-if="item.deadlineUsesWorkingHours" class="text-slate-400">(jam kerja)</span>
                </p>
              </td>

              <td class="px-5 py-4 text-center">
                <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200/60">
                  {{ item.rulesCount }} Aturan
                </span>
              </td>

              <td class="px-5 py-4 text-right">
                <NuxtLink
                  :to="`/admin/aturan/${item.leaveTypeId}`"
                  class="btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Atur Aturan
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tampilan Kartu (Mobile) -->
      <div v-if="policies.length > 0" class="md:hidden divide-y divide-slate-100">
        <div
          v-for="item in policies"
          :key="item.id"
          class="p-4 space-y-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <span
                class="h-3 w-3 rounded-full flex-shrink-0"
                :style="{ backgroundColor: item.leaveTypeColor || '#64748B' }"
              ></span>
              <div>
                <h3 class="text-sm font-bold text-slate-900">{{ item.leaveTypeName }}</h3>
                <p class="text-[10px] font-mono text-slate-400 uppercase">{{ item.leaveTypeCode }}</p>
              </div>
            </div>
            <span class="badge bg-brand-50 text-brand-700 font-bold text-xs">
              {{ item.rulesCount }} Aturan
            </span>
          </div>

          <div class="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-100">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Kebijakan:</span>
              <span class="font-semibold text-slate-800">{{ item.name }} (v{{ item.version }})</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Berlaku:</span>
              <span class="text-slate-700">
                {{ dayjs(item.effectiveFrom).format('D MMM YYYY') }} - {{ item.effectiveTo ? dayjs(item.effectiveTo).format('D MMM YYYY') : 'Sekarang' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Batas Deadline:</span>
              <span class="font-medium text-slate-800">{{ Number(item.overallDeadlineHours) }} jam ({{ formatAction(item.onDeadlineAction) }})</span>
            </div>
          </div>

          <div class="pt-1 flex items-center justify-end">
            <NuxtLink
              :to="`/admin/aturan/${item.leaveTypeId}`"
              class="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Kelola & Uji Aturan
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
