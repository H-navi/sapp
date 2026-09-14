<script setup lang="ts">
useHead({
  title: 'Pengajuan Perizinan',
})

const route = useRoute()

const selectedStatus = ref<string>((route.query.status as string) || '')
const page = ref(Number(route.query.page) || 1)
const perPage = ref(20)

const statusFilters = [
  { label: 'Semua', value: '' },
  { label: 'Menunggu', value: 'SUBMITTED' },
  { label: 'Sedang Direviu', value: 'IN_REVIEW' },
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
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader
      title="Pengajuan Perizinan"
      subtitle="Kelola dan pantau seluruh permohonan izin atau cuti Anda."
    >
      <template #actions>
        <NuxtLink
          to="/pengajuan/baru"
          class="btn-primary"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Buat Pengajuan</span>
        </NuxtLink>
      </template>
    </AppPageHeader>

    <!-- Filter Status Horizontal Scrollable Chips (Touch-friendly) -->
    <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
      <button
        v-for="f in statusFilters"
        :key="f.value"
        type="button"
        class="px-3.5 py-2 text-xs font-semibold rounded-full border shrink-0 transition min-h-[44px]"
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

    <!-- Loading Skeleton -->
    <div v-if="pending" class="space-y-3">
      <AppSkeleton type="card" :count="4" />
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
          class="btn-primary"
        >
          Buat Pengajuan Pertama
        </NuxtLink>
      </template>
    </AppEmptyState>

    <!-- Cards Stack (Mobile-First 320px-ready) -->
    <div v-else class="space-y-3">
      <RequestCard
        v-for="r in requestsData.data.items"
        :key="r.id"
        :request="r"
        :show-requester="false"
      />

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

