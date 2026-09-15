<script setup lang="ts">
import dayjs from 'dayjs'

const { t, formatDate, locale } = useI18n()
const { user, can, hasRole } = useAuth()

useHead({
  title: computed(() => `${t('nav.home')} · ${t('nav.brandSubtitle')}`),
})

// 1. Data status sistem
const { data: healthRes } = await useFetch<{
  data: { database: string; waktu: string; pegawai: number; jenis_izin: number }
}>('/api/health')

const health = computed(() => healthRes.value?.data)

// 2. Data inbox approval jika user adalah approver
const isApprover = computed(() => can('approval.view') || can('approval.act'))
const { data: inboxRes } = await useFetch<{ data: any[] }>('/api/approvals/inbox', {
  lazy: true,
  server: false,
  immediate: isApprover.value,
})
const pendingApprovalCount = computed(() => inboxRes.value?.data?.length ?? 0)

// 3. Data permohonan terkini jika user memiliki hak request
const hasRequestAccess = computed(() => can('request.view') || can('request.create'))
const { data: requestsRes } = await useFetch<{ data: { items: any[] } | any[] }>('/api/requests', {
  query: { limit: 5 },
  lazy: true,
  server: false,
  immediate: hasRequestAccess.value,
})

const recentRequests = computed(() => {
  const d = requestsRes.value?.data
  if (Array.isArray(d)) return d.slice(0, 5)
  if (d && Array.isArray((d as any).items)) return (d as any).items.slice(0, 5)
  return []
})

const todayFormatted = computed(() => {
  return formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
})
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Welcome Hero Section (Desktop & Mobile) -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-700 p-6 sm:p-8 text-white shadow-lg">
      <div class="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
      <div class="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl pointer-events-none"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div class="space-y-2">
          <div class="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-xs text-brand-100">
            <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{{ todayFormatted }}</span>
            <span>·</span>
            <span>AutoLeave</span>
          </div>

          <h1 class="text-2xl sm:text-3xl font-black tracking-tight">
            {{ t('home.greeting') }}, {{ user?.fullName || user?.username || 'Pegawai' }}! 👋
          </h1>
          <p class="text-xs sm:text-sm text-brand-100/90 max-w-xl leading-relaxed">
            {{ t('auth.signInSubtitle') }}
          </p>
        </div>

        <!-- Quick Action Buttons on Hero -->
        <div class="flex flex-wrap items-center gap-3 pt-2 md:pt-0">
          <NuxtLink
            to="/pengajuan/baru"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-brand-700 shadow-md hover:bg-brand-50 active:scale-[0.98] transition"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
            {{ t('home.applyLeave') }}
          </NuxtLink>

          <NuxtLink
            v-if="isApprover"
            to="/approval"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-white/20 border border-white/30 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/30 active:scale-[0.98] transition backdrop-blur-xs"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {{ t('home.viewApproval') }}
            <span v-if="pendingApprovalCount > 0" class="badge bg-amber-400 text-amber-950 font-black text-[10px] px-1.5 py-0.2">
              {{ pendingApprovalCount }}
            </span>
          </NuxtLink>

          <NuxtLink
            v-if="hasRole('ADMIN')"
            to="/admin"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-white/20 border border-white/30 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/30 active:scale-[0.98] transition backdrop-blur-xs"
          >
            {{ t('nav.admin') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Ringkasan Statistik Utama (Grid 4 Kolom di Desktop) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Status Server & DB -->
      <div class="card p-4 sm:p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">Database</span>
          <span class="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
        </div>
        <div class="mt-3">
          <p class="text-xl sm:text-2xl font-black text-slate-900">
            {{ health?.database === 'ok' ? (locale === 'id' ? 'Terhubung' : 'Connected') : (locale === 'id' ? 'Memeriksa' : 'Checking') }}
          </p>
          <p class="text-[11px] text-slate-400 mt-0.5">PostgreSQL 16 · Online</p>
        </div>
      </div>

      <!-- Pegawai Terdaftar -->
      <div class="card p-4 sm:p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">{{ locale === 'id' ? 'Total Pegawai' : 'Total Employees' }}</span>
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
        <div class="mt-3">
          <p class="text-xl sm:text-2xl font-black text-slate-900">
            {{ health?.pegawai ?? 10 }}
          </p>
          <p class="text-[11px] text-slate-400 mt-0.5">{{ locale === 'id' ? 'Karyawan aktif' : 'Active employees' }}</p>
        </div>
      </div>

      <!-- Jenis Izin & Kebijakan -->
      <div class="card p-4 sm:p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">{{ t('requests.leaveType') }}</span>
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <div class="mt-3">
          <p class="text-xl sm:text-2xl font-black text-slate-900">
            {{ health?.jenis_izin ?? 6 }}
          </p>
          <p class="text-[11px] text-slate-400 mt-0.5">Cuti, WFA, Sakit, Khusus</p>
        </div>
      </div>

      <!-- Tugas Approval Menunggu -->
      <div class="card p-4 sm:p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">{{ t('approval.pendingTasks') }}</span>
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div class="mt-3">
          <p class="text-xl sm:text-2xl font-black text-slate-900">
            {{ pendingApprovalCount }}
          </p>
          <p class="text-[11px] text-slate-400 mt-0.5">{{ t('home.pendingApprovals') }}</p>
        </div>
      </div>
    </div>

    <!-- Modul & Fitur Utama (Grid Menu Desktop) -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-base sm:text-lg font-black text-slate-900 tracking-tight">
          {{ t('home.quickAction') }}
        </h2>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Menu 1: Pengajuan Izin -->
        <NuxtLink
          to="/pengajuan/baru"
          class="card p-5 block hover:border-brand-500 hover:shadow-md transition-all active:scale-[0.99] group"
        >
          <div class="flex items-start justify-between">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h3 class="mt-4 text-base font-bold text-slate-900 group-hover:text-brand-600 transition">
            {{ t('requests.newRequest') }}
          </h3>
          <p class="mt-1 text-xs text-slate-500 leading-relaxed">
            {{ t('requests.submitConfirmMsg') }}
          </p>
        </NuxtLink>

        <!-- Menu 2: Daftar Permohonan Saya -->
        <NuxtLink
          to="/pengajuan"
          class="card p-5 block hover:border-brand-500 hover:shadow-md transition-all active:scale-[0.99] group"
        >
          <div class="flex items-start justify-between">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <h3 class="mt-4 text-base font-bold text-slate-900 group-hover:text-brand-600 transition">
            {{ t('requests.myRequests') }}
          </h3>
          <p class="mt-1 text-xs text-slate-500 leading-relaxed">
            {{ t('home.viewAllRequests') }}
          </p>
        </NuxtLink>

        <!-- Menu 3: Kotak Masuk Approval -->
        <NuxtLink
          to="/approval"
          class="card p-5 block hover:border-brand-500 hover:shadow-md transition-all active:scale-[0.99] group"
        >
          <div class="flex items-start justify-between">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span v-if="pendingApprovalCount > 0" class="badge bg-amber-100 text-amber-900 font-bold text-xs">
              {{ pendingApprovalCount }}
            </span>
          </div>
          <h3 class="mt-4 text-base font-bold text-slate-900 group-hover:text-brand-600 transition">
            {{ t('approval.approvalInbox') }}
          </h3>
          <p class="mt-1 text-xs text-slate-500 leading-relaxed">
            {{ t('approval.rulesEvaluation') }}
          </p>
        </NuxtLink>
      </div>
    </div>

    <!-- Riwayat / Aktivitas Pengajuan Terbaru -->
    <div v-if="recentRequests.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-base sm:text-lg font-black text-slate-900 tracking-tight">
          {{ t('home.recentRequests') }}
        </h2>
        <NuxtLink to="/pengajuan" class="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
          {{ t('home.viewAllRequests') }}
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <div class="card overflow-hidden divide-y divide-slate-100 p-0">
        <div
          v-for="req in recentRequests"
          :key="req.id"
          class="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition"
        >
          <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs font-semibold text-slate-400">#{{ req.requestNumber }}</span>
              <StatusBadge :status="req.status" size="sm" />
            </div>
            <h4 class="text-sm font-bold text-slate-900 truncate">
              {{ req.leaveTypeName || t('requests.leaveType') }}
            </h4>
            <p class="text-xs text-slate-500 tabular-nums">
              {{ dayjs(req.startDate).format('D MMM YYYY') }} – {{ dayjs(req.endDate).format('D MMM YYYY') }}
              · {{ req.workingDays }} {{ t('requests.workingDays').toLowerCase() }}
            </p>
          </div>

          <NuxtLink
            :to="`/pengajuan/${req.id}`"
            class="btn-ghost text-xs px-3 py-1.5 shrink-0"
          >
            {{ t('common.viewDetails') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
