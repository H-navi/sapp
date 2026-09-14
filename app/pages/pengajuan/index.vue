<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Daftar Pengajuan Perizinan',
})

const route = useRoute()
const router = useRouter()

const selectedStatus = ref<string>((route.query.status as string) || '')
const page = ref(Number(route.query.page) || 1)
const perPage = ref(20)

const statusFilters = [
  { label: 'Semua', value: '' },
  { label: 'Menunggu', value: 'SUBMITTED' },
  { label: 'Diproses', value: 'IN_REVIEW' },
  { label: 'Disetujui', value: 'APPROVED' },
  { label: 'Ditolak', value: 'REJECTED' },
  { label: 'Draf', value: 'DRAFT' },
  { label: 'Dibatalkan', value: 'CANCELLED' },
]

const { data: requestsData, pending, refresh } = await useFetch<{
  data: {
    items: any[]
    total: number
    page: number
    perPage: number
    totalPages: number
  }
}>('/api/requests', {
  query: computed(() => ({
    status: selectedStatus.value || undefined,
    page: page.value,
    perPage: perPage.value,
  })),
})

function setFilter(val: string) {
  selectedStatus.value = val
  page.value = 1
}

function statusBadge(status: string) {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draf', class: 'bg-slate-100 text-slate-700 border-slate-200' }
    case 'SUBMITTED':
      return { label: 'Menunggu', class: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'IN_REVIEW':
      return { label: 'Sedang Direviu', class: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'APPROVED':
      return { label: 'Disetujui', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'REJECTED':
      return { label: 'Ditolak', class: 'bg-red-50 text-red-700 border-red-200' }
    case 'CANCELLED':
      return { label: 'Dibatalkan', class: 'bg-slate-100 text-slate-500 border-slate-200' }
    case 'EXPIRED':
      return { label: 'Kadaluarsa', class: 'bg-rose-50 text-rose-700 border-rose-200' }
    default:
      return { label: status, class: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

function formatDateRange(start: string, end: string) {
  const s = dayjs(start).format('DD MMM YYYY')
  const e = dayjs(end).format('DD MMM YYYY')
  if (s === e) return s
  return `${s} – ${e}`
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader
      title="Pengajuan Perizinan"
      description="Kelola dan pantau seluruh permohonan izin atau cuti Anda."
    >
      <template #actions>
        <NuxtLink
          to="/pengajuan/baru"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Ajukan Izin Baru
        </NuxtLink>
      </template>
    </AppPageHeader>

    <!-- Filter Status Horizontal Scrollable Chips -->
    <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
      <button
        v-for="f in statusFilters"
        :key="f.value"
        type="button"
        class="px-3 py-1.5 text-xs font-semibold rounded-full border shrink-0 transition"
        :class="
          selectedStatus === f.value
            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        "
        @click="setFilter(f.value)"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="py-12 flex justify-center items-center">
      <div class="inline-flex items-center gap-2 text-slate-500 text-sm">
        <svg class="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Memuat data pengajuan...
      </div>
    </div>

    <!-- Empty State -->
    <AppEmptyState
      v-else-if="!requestsData?.data?.items?.length"
      title="Belum ada pengajuan"
      description="Anda belum memiliki daftar pengajuan perizinan dengan filter ini."
    >
      <template #action>
        <NuxtLink
          to="/pengajuan/baru"
          class="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Buat Pengajuan Pertama
        </NuxtLink>
      </template>
    </AppEmptyState>

    <!-- Cards Stack (Mobile-First 360px) -->
    <div v-else class="space-y-3">
      <NuxtLink
        v-for="r in requestsData.data.items"
        :key="r.id"
        :to="`/pengajuan/${r.id}`"
        class="block bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-400 hover:shadow-md transition active:scale-[0.99]"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="text-xs px-2.5 py-0.5 rounded-full font-bold border"
                :class="statusBadge(r.status).class"
              >
                {{ statusBadge(r.status).label }}
              </span>
              <span class="text-xs font-mono text-slate-500 truncate">
                {{ r.requestNumber }}
              </span>
            </div>
            <h3 class="font-bold text-slate-900 text-base flex items-center gap-2 pt-0.5">
              <span
                class="w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: r.leaveType?.color || '#3b82f6' }"
              ></span>
              {{ r.leaveType?.name || 'Jenis Izin' }}
            </h3>
          </div>

          <div class="text-right shrink-0">
            <span class="text-base font-extrabold text-blue-600">
              {{ r.totalDays }}
            </span>
            <span class="text-xs text-slate-500 block">hari</span>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div class="flex items-center gap-1.5 truncate">
            <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="font-medium text-slate-700">{{ formatDateRange(r.startDate, r.endDate) }}</span>
          </div>

          <span class="text-slate-400 shrink-0">
            {{ dayjs(r.createdAt).format('DD/MM/YY') }} &rarr;
          </span>
        </div>
      </NuxtLink>

      <!-- Pagination -->
      <AppPagination
        v-if="requestsData.data.totalPages > 1"
        :page="page"
        :total-pages="requestsData.data.totalPages"
        :total="requestsData.data.total"
        @change="(p) => (page = p)"
      />
    </div>
  </div>
</template>
