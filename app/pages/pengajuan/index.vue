<script setup lang="ts">
const { t } = useI18n()

useHead({
  title: computed(() => t('requests.myRequests')),
})

const route = useRoute()

const selectedStatus = ref<string>((route.query.status as string) || '')
const page = ref(Number(route.query.page) || 1)
const perPage = ref(20)

const statusFilters = computed(() => [
  { label: t('common.all'), value: '' },
  { label: t('status.pending'), value: 'SUBMITTED' },
  { label: t('status.inReview'), value: 'IN_REVIEW' },
  { label: t('status.approved'), value: 'APPROVED' },
  { label: t('status.rejected'), value: 'REJECTED' },
  { label: t('status.draft'), value: 'DRAFT' },
  { label: t('status.cancelled'), value: 'CANCELLED' },
])

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
      :title="t('requests.myRequests')"
      :subtitle="t('home.welcomeBack')"
    >
      <template #actions>
        <NuxtLink
          to="/pengajuan/baru"
          class="btn-primary"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ t('requests.newRequest') }}</span>
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
      :title="t('common.noData')"
      :description="t('home.noRecentRequests')"
    >
      <template #action>
        <NuxtLink
          to="/pengajuan/baru"
          class="btn-primary"
        >
          {{ t('requests.newRequest') }}
        </NuxtLink>
      </template>
    </AppEmptyState>

    <!-- Request Cards Grid / Feed -->
    <div v-else class="space-y-3">
      <RequestCard
        v-for="req in requestsData.data.items"
        :key="req.id"
        :request="req"
      />

      <!-- Pagination Controls -->
      <div v-if="requestsData.data.totalPages > 1" class="pt-4 flex items-center justify-between text-xs text-slate-500">
        <div>
          Halaman {{ requestsData.data.page }} dari {{ requestsData.data.totalPages }} (Total {{ requestsData.data.total }})
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="btn-secondary text-xs px-3 py-1.5"
            :disabled="page <= 1"
            @click="page--"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            class="btn-secondary text-xs px-3 py-1.5"
            :disabled="page >= requestsData.data.totalPages"
            @click="page++"
          >
            Selanjutnya
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
