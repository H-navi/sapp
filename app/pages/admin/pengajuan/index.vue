<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Pengawasan Pengajuan Izin · Admin',
})

const route = useRoute()
const router = useRouter()

// Filter State
const search = ref(String(route.query.search || ''))
const selectedStatus = ref(String(route.query.status || ''))
const selectedDept = ref(String(route.query.department_id || ''))
const selectedLeaveType = ref(String(route.query.leave_type_id || ''))
const startDate = ref(String(route.query.start_date || ''))
const endDate = ref(String(route.query.end_date || ''))
const page = ref(Number(route.query.page || 1))

// Fetch Departments & Leave Types for filter options
const { data: deptsRes } = await useFetch<{ data: any[] }>('/api/departments')
const { data: typesRes } = await useFetch<{ data: any[] }>('/api/leave-types')

const departments = computed(() => deptsRes.value?.data || [])
const leaveTypes = computed(() => typesRes.value?.data || [])

// Fetch Requests
const queryParams = computed(() => ({
  page: page.value,
  limit: 15,
  search: search.value || undefined,
  status: selectedStatus.value || undefined,
  department_id: selectedDept.value || undefined,
  leave_type_id: selectedLeaveType.value || undefined,
  start_date: startDate.value || undefined,
  end_date: endDate.value || undefined,
}))

const { data: res, pending, refresh } = await useFetch<{
  data: any[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  summary: { total: number; inReview: number; approved: number; rejected: number; expired: number }
}>('/api/admin/requests', {
  query: queryParams,
})

const requests = computed(() => res.value?.data || [])
const pagination = computed(() => res.value?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 })
const summary = computed(() => res.value?.summary || { total: 0, inReview: 0, approved: 0, rejected: 0, expired: 0 })

function setQuickStatus(status: string) {
  selectedStatus.value = status
  page.value = 1
}

function formatDate(d?: string | null) {
  if (!d) return '-'
  return dayjs(d).format('D MMM YYYY')
}
</script>



<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span class="w-3 h-3 rounded-full bg-blue-600"></span>
          Pengawasan Pengajuan Izin
        </h1>
        <p class="text-xs text-slate-500 mt-1">
          Pantau seluruh alur persetujuan, eskalasi tugas, dan lakukan intervensi alur bila diperlukan.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink
          to="/laporan"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
        >
          <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Buka Laporan
        </NuxtLink>
        <NuxtLink
          to="/laporan/kalender"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
        >
          <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Kalender Tim
        </NuxtLink>
      </div>
    </div>

    <!-- KPI Metric Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <button
        type="button"
        class="text-left p-4 rounded-2xl border transition-all"
        :class="selectedStatus === '' ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-100 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'"
        @click="setQuickStatus('')"
      >
        <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Semua Pengajuan</div>
        <div class="text-2xl font-black text-slate-900 mt-1">{{ summary.total }}</div>
      </button>

      <button
        type="button"
        class="text-left p-4 rounded-2xl border transition-all"
        :class="selectedStatus === 'IN_REVIEW' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'"
        @click="setQuickStatus('IN_REVIEW')"
      >
        <div class="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Menunggu Reviu</div>
        <div class="text-2xl font-black text-blue-700 mt-1">{{ summary.inReview }}</div>
      </button>

      <button
        type="button"
        class="text-left p-4 rounded-2xl border transition-all"
        :class="selectedStatus === 'APPROVED' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-100 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'"
        @click="setQuickStatus('APPROVED')"
      >
        <div class="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Disetujui</div>
        <div class="text-2xl font-black text-emerald-700 mt-1">{{ summary.approved }}</div>
      </button>

      <button
        type="button"
        class="text-left p-4 rounded-2xl border transition-all"
        :class="selectedStatus === 'REJECTED' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-100 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'"
        @click="setQuickStatus('REJECTED')"
      >
        <div class="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Ditolak</div>
        <div class="text-2xl font-black text-rose-700 mt-1">{{ summary.rejected }}</div>
      </button>

      <button
        type="button"
        class="text-left p-4 rounded-2xl border transition-all col-span-2 sm:col-span-1"
        :class="selectedStatus === 'EXPIRED' ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'"
        @click="setQuickStatus('EXPIRED')"
      >
        <div class="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Kedaluwarsa</div>
        <div class="text-2xl font-black text-slate-800 mt-1">{{ summary.expired }}</div>
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <!-- Search Input -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Cari Pegawai / Nomor</label>
          <input
            v-model="search"
            type="text"
            placeholder="Ketik nama, NIP, atau nomor..."
            class="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            @keyup.enter="page = 1"
          />
        </div>

        <!-- Departemen Filter -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Departemen</label>
          <select
            v-model="selectedDept"
            class="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            @change="page = 1"
          >
            <option value="">Semua Departemen</option>
            <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>

        <!-- Jenis Izin Filter -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Jenis Izin</label>
          <select
            v-model="selectedLeaveType"
            class="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            @change="page = 1"
          >
            <option value="">Semua Jenis Izin</option>
            <option v-for="t in leaveTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <!-- Rentang Tanggal Cepat -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Mulai Dari Tanggal</label>
          <input
            v-model="startDate"
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
        Memuat daftar pengajuan...
      </div>

      <!-- Empty State -->
      <div v-else-if="requests.length === 0" class="p-12 text-center space-y-2">
        <p class="text-slate-500 text-sm font-medium">Tidak ada pengajuan yang sesuai dengan kriteria filter.</p>
        <button
          type="button"
          class="text-xs font-semibold text-blue-600 hover:underline"
          @click="selectedStatus = ''; search = ''; selectedDept = ''; selectedLeaveType = ''; startDate = ''; page = 1;"
        >
          Reset Seluruh Filter
        </button>
      </div>

      <!-- Data Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
            <tr>
              <th class="py-3 px-4">Pengajuan</th>
              <th class="py-3 px-4">Pemohon</th>
              <th class="py-3 px-4">Jenis Izin</th>
              <th class="py-3 px-4">Durasi & Jadwal</th>
              <th class="py-3 px-4">Status & Tahap</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="r in requests"
              :key="r.id"
              class="hover:bg-slate-50/70 transition-colors"
            >
              <!-- Request Number & Date -->
              <td class="py-3.5 px-4">
                <div class="font-bold text-slate-900">{{ r.requestNumber }}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">{{ formatDate(r.createdAt) }}</div>
              </td>

              <!-- Requester -->
              <td class="py-3.5 px-4">
                <div class="font-semibold text-slate-800">{{ r.employeeName }}</div>
                <div class="text-[11px] text-slate-400">NIP: {{ r.nip }} · {{ r.departmentName }}</div>
              </td>

              <!-- Leave Type -->
              <td class="py-3.5 px-4">
                <div class="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  <span
                    class="w-2.5 h-2.5 rounded-full"
                    :style="{ backgroundColor: r.leaveTypeColor || '#3b82f6' }"
                  ></span>
                  {{ r.leaveTypeName }}
                </div>
              </td>

              <!-- Duration -->
              <td class="py-3.5 px-4">
                <div class="font-semibold text-slate-900">{{ r.workingDays }} hari kerja</div>
                <div class="text-[11px] text-slate-500">
                  {{ formatDate(r.startDate) }} – {{ formatDate(r.endDate) }}
                </div>
              </td>

              <!-- Status & Current Step -->
              <td class="py-3.5 px-4">
                <StatusBadge :status="r.status" size="sm" />
                <div v-if="r.activeStepName" class="text-[11px] text-slate-500 mt-1">
                  Tahap: {{ r.activeStepName }}
                </div>
              </td>


              <!-- Action Link -->
              <td class="py-3.5 px-4 text-right whitespace-nowrap">
                <NuxtLink
                  :to="`/admin/pengajuan/${r.id}`"
                  class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition"
                >
                  Detail & Intervensi &rarr;
                </NuxtLink>
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
          Menampilkan {{ requests.length }} dari {{ pagination.total }} pengajuan
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
  </div>
</template>
