<script setup lang="ts">
import dayjs from 'dayjs'

const { t, locale } = useI18n()

useHead({
  title: computed(() => `${t('approval.approvalInbox')} · ${t('nav.brandSubtitle')}`),
})

const activeTab = ref<'all' | 'urgent' | 'overdue' | 'delegated'>('all')

const queryFilter = computed(() => {
  if (activeTab.value === 'urgent') return 'urgent'
  if (activeTab.value === 'overdue') return 'overdue'
  return 'all'
})

const { data: res, pending, refresh } = await useFetch<{ data: any[] }>('/api/approvals/inbox', {
  query: computed(() => ({ filter: queryFilter.value })),
})

const rawTasks = computed(() => res.value?.data ?? [])

// Saring tugas jika tab delegasi dipilih
const tasks = computed(() => {
  if (activeTab.value === 'delegated') {
    return rawTasks.value.filter((t) => t.isDelegate)
  }
  return rawTasks.value
})

// Hitung metrik ringkas
const countOverdue = computed(() => rawTasks.value.filter((t) => t.isOverdue).length)
const countUrgent = computed(
  () => rawTasks.value.filter((t) => !t.isOverdue && t.remainingSeconds > 0 && t.remainingSeconds <= 4 * 3600).length
)
const countDelegated = computed(() => rawTasks.value.filter((t) => t.isDelegate).length)

function formatSlaLabel(task: any) {
  if (task.isOverdue) {
    const mins = Math.max(1, Math.round(Math.abs(task.remainingSeconds || 0) / 60))
    if (mins < 60) return locale.value === 'en' ? `Overdue by ${mins} mins` : `Terlambat ${mins} menit`
    const hours = Math.floor(mins / 60)
    return locale.value === 'en' ? `Overdue by ${hours} hours` : `Terlambat ${hours} jam`
  }
  if (!task.dueAt) return locale.value === 'en' ? 'No SLA Deadline' : 'Tanpa Batas SLA'

  const secs = task.remainingSeconds || 0
  if (secs <= 0) return locale.value === 'en' ? 'Deadline Reached' : 'Batas Waktu Tiba'
  const hours = Math.floor(secs / 3600)
  const mins = Math.floor((secs % 3600) / 60)

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return locale.value === 'en' ? `${days} days left` : `${days} hari lagi`
  }
  if (hours > 0) {
    return locale.value === 'en' ? `${hours}h ${mins}m left` : `${hours} jam ${mins} m lagi`
  }
  return locale.value === 'en' ? `${mins} mins left` : `${mins} menit lagi`
}

function getSlaBadgeClass(task: any) {
  if (task.isOverdue) {
    return 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
  }
  if (task.remainingSeconds > 0 && task.remainingSeconds <= 4 * 3600) {
    return 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
  }
  return 'bg-slate-100 text-slate-700 border-slate-200'
}
</script>

<template>
  <div class="space-y-5 pb-10">
    <!-- Header Halaman -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
          {{ t('approval.approvalInbox') }}
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 sm:text-sm">
          {{ t('approval.taskDetail') }}
        </p>
      </div>

      <!-- Navigasi Pintas Antar Halaman Approval -->
      <div class="flex items-center gap-2">
        <NuxtLink
          to="/approval/riwayat"
          class="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5"
        >
          <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ t('approval.taskHistory') }}
        </NuxtLink>

        <NuxtLink
          to="/approval/delegasi"
          class="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5"
        >
          <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {{ t('approval.delegationTab') }}
          <span v-if="countDelegated > 0" class="badge bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.2">
            {{ countDelegated }}
          </span>
        </NuxtLink>

        <button
          type="button"
          class="btn-ghost text-xs p-2 text-slate-600 hover:text-slate-900"
          :disabled="pending"
          :title="t('common.refresh')"
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
        </button>
      </div>
    </div>

    <!-- Filter Chips / Tabs -->
    <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
      <button
        type="button"
        class="px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap"
        :class="activeTab === 'all' ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'"
        @click="activeTab = 'all'"
      >
        {{ t('common.all') }}
        <span class="ml-1 opacity-80">({{ rawTasks.length }})</span>
      </button>

      <button
        type="button"
        class="px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5"
        :class="activeTab === 'urgent' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'"
        @click="activeTab = 'urgent'"
      >
        <span class="h-2 w-2 rounded-full bg-amber-400"></span>
        {{ locale === 'en' ? 'Urgent (< 4 Hrs)' : 'Mendesak (< 4 Jam)' }}
        <span v-if="countUrgent > 0" class="badge bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.5 ml-0.5">
          {{ countUrgent }}
        </span>
      </button>

      <button
        type="button"
        class="px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5"
        :class="activeTab === 'overdue' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'"
        @click="activeTab = 'overdue'"
      >
        <span class="h-2 w-2 rounded-full bg-rose-400"></span>
        {{ locale === 'en' ? 'SLA Overdue' : 'Terlambat SLA' }}
        <span v-if="countOverdue > 0" class="badge bg-rose-100 text-rose-900 text-[10px] px-1.5 py-0.5 ml-0.5">
          {{ countOverdue }}
        </span>
      </button>

      <button
        type="button"
        class="px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5"
        :class="activeTab === 'delegated' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'"
        @click="activeTab = 'delegated'"
      >
        {{ locale === 'en' ? 'Delegated' : 'Mewakili Delegasi' }}
        <span v-if="countDelegated > 0" class="badge bg-indigo-100 text-indigo-900 text-[10px] px-1.5 py-0.5 ml-0.5">
          {{ countDelegated }}
        </span>
      </button>
    </div>

    <!-- State Memuat -->
    <div v-if="pending && tasks.length === 0" class="space-y-3">
      <AppSkeleton type="card" :count="3" />
    </div>

    <!-- State Kosong -->
    <AppEmptyState
      v-else-if="tasks.length === 0"
      :title="locale === 'en' ? 'Inbox Zero' : 'Kotak Masuk Bersih'"
      :description="locale === 'en' ? 'No pending leave requests requiring your review.' : 'Tidak ada permohonan izin yang sedang menunggu persetujuan Anda saat ini.'"
    />

    <!-- Daftar Kartu Tugas Persetujuan -->
    <div v-else class="space-y-3">
      <NuxtLink
        v-for="task in tasks"
        :key="task.taskId"
        :to="`/approval/${task.taskId}`"
        class="card block hover:border-blue-400 hover:shadow-md transition-all active:scale-[0.99] p-4 sm:p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <!-- Info Pemohon & Judul Izin -->
          <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <CountdownLabel
                :due-at="task.dueAt"
                :remaining-seconds="task.remainingSeconds"
                :is-overdue="task.isOverdue"
              />

              <span
                v-if="task.isDelegate"
                class="badge bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold"
              >
                {{ locale === 'en' ? 'Delegated' : 'Mewakili Delegasi' }}
              </span>

              <span class="text-[11px] font-mono text-slate-400">
                #{{ task.requestNumber }}
              </span>
            </div>

            <h2 class="text-base font-bold text-slate-900 pt-1">
              {{ task.requester.fullName }}
            </h2>
            <p class="text-xs text-slate-500">
              {{ task.requester.positionName || 'Pegawai' }} · {{ task.requester.departmentName || 'Divisi' }}
            </p>
          </div>

          <!-- Indikator Jenis Izin -->
          <div class="text-right flex-shrink-0">
            <LeaveTypeChip
              :name="task.leaveType.name"
              :color="task.leaveType.color"
            />
            <p class="text-xs font-semibold text-blue-700 mt-1.5 tabular-nums">
              {{ task.workingDays }} {{ t('requests.workingDays').toLowerCase() }}
            </p>
          </div>
        </div>

        <!-- Periode & Alasan Singkat -->
        <div class="mt-3.5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div class="flex items-center gap-2 text-slate-600">
            <svg class="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="font-medium">
              {{ dayjs(task.startDate).format('D MMM YYYY') }}
              <template v-if="task.startDate !== task.endDate">
                – {{ dayjs(task.endDate).format('D MMM YYYY') }}
              </template>
            </span>
          </div>

          <div class="flex items-center gap-1 text-blue-700 font-semibold text-xs sm:ml-auto">
            <span>{{ locale === 'en' ? 'Review' : 'Tinjau' }}</span>
          </div>
        </div>

        <!-- Kutipan Alasan jika ada -->
        <p v-if="task.reason" class="mt-2 text-xs text-slate-500 line-clamp-1 italic bg-slate-50 px-2.5 py-1 rounded">
          "{{ task.reason }}"
        </p>
      </NuxtLink>
    </div>
  </div>
</template>
