<script setup lang="ts">
useHead({
  title: 'Kelola Pegawai',
})

const route = useRoute()
const router = useRouter()

const search = ref((route.query.q as string) || '')
const departmentId = ref((route.query.departmentId as string) || '')
const statusFilter = ref((route.query.isActive as string) || 'all')
const page = ref(Number(route.query.page) || 1)

// Ambil daftar departemen untuk filter dropdown
const { data: deptData } = await useFetch<{ data: Array<{ id: string; name: string }> }>('/api/admin/departments')
const departments = computed(() => deptData.value?.data ?? [])

// Fetch daftar pegawai
const queryParams = computed(() => {
  const p: Record<string, any> = {
    page: page.value,
    perPage: 15,
  }
  if (search.value) p.q = search.value
  if (departmentId.value) p.departmentId = departmentId.value
  if (statusFilter.value === 'active') p.isActive = true
  if (statusFilter.value === 'inactive') p.isActive = false
  return p
})

const { data: employeeData, pending, refresh } = await useFetch('/api/admin/employees', {
  query: queryParams,
})

const employees = computed(() => employeeData.value?.data?.items ?? [])
const total = computed(() => employeeData.value?.data?.total ?? 0)
const totalPages = computed(() => employeeData.value?.data?.totalPages ?? 1)

function handleSearch(val: string) {
  page.value = 1
  search.value = val
  updateRouteQuery()
}

function handleDepartmentChange() {
  page.value = 1
  updateRouteQuery()
}

function handleStatusChange() {
  page.value = 1
  updateRouteQuery()
}

function handlePageChange(newPage: number) {
  page.value = newPage
  updateRouteQuery()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function updateRouteQuery() {
  router.push({
    query: {
      ...queryParams.value,
    },
  })
}
</script>

<template>
  <div class="space-y-4">
    <AppPageHeader
      title="Daftar Pegawai"
      subtitle="Kelola data induk seluruh pegawai perusahaan"
    >
      <template #actions>
        <NuxtLink to="/admin/pegawai/baru" class="btn-primary text-xs px-3 py-2">
          + Pegawai Baru
        </NuxtLink>
      </template>
    </AppPageHeader>

    <!-- Filter & Pencarian -->
    <div class="card space-y-3 p-3 sm:p-4">
      <AppSearchBar
        v-model="search"
        placeholder="Cari nama, NIP, atau email..."
        @search="handleSearch"
      />

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label class="label text-xs">Departemen</label>
          <select v-model="departmentId" class="input text-xs py-2" @change="handleDepartmentChange">
            <option value="">Semua Departemen</option>
            <option v-for="dept in departments" :key="dept.id" :value="dept.id">
              {{ dept.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="label text-xs">Status Akun</label>
          <select v-model="statusFilter" class="input text-xs py-2" @change="handleStatusChange">
            <option value="all">Semua Status</option>
            <option value="active">Hanya Aktif</option>
            <option value="inactive">Hanya Nonaktif</option>
          </select>
        </div>
      </div>
    </div>

    <!-- State Loading -->
    <div v-if="pending" class="space-y-3">
      <div v-for="i in 3" :key="i" class="card h-24 animate-pulse bg-slate-100" />
    </div>

    <!-- Daftar Pegawai (Card Mobile-First) -->
    <div v-else-if="employees.length > 0" class="space-y-3">
      <EmployeeCard
        v-for="emp in employees"
        :key="emp.id"
        :employee="emp"
      />

      <AppPagination
        :page="page"
        :total-pages="totalPages"
        :total="total"
        @change="handlePageChange"
      />
    </div>

    <!-- Empty State -->
    <AppEmptyState
      v-else
      title="Tidak ada pegawai ditemukan"
      description="Coba ubah kata kunci pencarian atau sesuaikan filter departemen/status."
    >
      <template #action>
        <button
          type="button"
          class="btn-ghost text-xs"
          @click="search = ''; departmentId = ''; statusFilter = 'all'; refresh()"
        >
          Reset Filter
        </button>
      </template>
    </AppEmptyState>
  </div>
</template>
