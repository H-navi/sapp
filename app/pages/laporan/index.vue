<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Laporan & Rekapitulasi Perizinan · HRD & Manajemen',
})

// Filter State
const periodType = ref<'month' | 'quarter' | 'year' | 'custom'>('month')
const customFrom = ref(dayjs().startOf('month').format('YYYY-MM-DD'))
const customTo = ref(dayjs().endOf('month').format('YYYY-MM-DD'))
const selectedDept = ref('')
const selectedLeaveType = ref('')
const activeTab = ref<'type' | 'department' | 'quota' | 'performance' | 'auto'>('type')

// Fetch options
const { data: deptsRes } = await useFetch<{ data: any[] }>('/api/departments')
const { data: typesRes } = await useFetch<{ data: any[] }>('/api/leave-types')
const departments = computed(() => deptsRes.value?.data || [])
const leaveTypes = computed(() => typesRes.value?.data || [])

// Fetch Summary Data
const queryParams = computed(() => ({
  period: periodType.value,
  from: periodType.value === 'custom' ? customFrom.value : undefined,
  to: periodType.value === 'custom' ? customTo.value : undefined,
  department_id: selectedDept.value || undefined,
  leave_type_id: selectedLeaveType.value || undefined,
}))

const { data: res, pending, refresh } = await useFetch<{ data: any }>('/api/reports/summary', {
  query: queryParams,
})

const summaryData = computed(() => res.value?.data)
const summary = computed(() => summaryData.value?.summary || {})
const byLeaveType = computed(() => summaryData.value?.byLeaveType || [])
const byDepartment = computed(() => summaryData.value?.byDepartment || [])
const quotaBalances = computed(() => summaryData.value?.quotaBalances || [])
const approverPerformance = computed(() => summaryData.value?.approverPerformance || [])
const autoDecidedList = computed(() => summaryData.value?.autoDecidedList || [])

// Download CSV
function downloadCsv(type: 'requests' | 'quota' | 'performance' = 'requests') {
  const from = summaryData.value?.period?.from || customFrom.value
  const to = summaryData.value?.period?.to || customTo.value
  let url = `/api/reports/export?type=${type}&from=${from}&to=${to}`
  if (selectedDept.value) url += `&department_id=${selectedDept.value}`
  if (selectedLeaveType.value) url += `&leave_type_id=${selectedLeaveType.value}`
  window.open(url, '_blank')
}

function formatDate(d?: string | null) {
  if (!d) return '-'
  return dayjs(d).format('D MMM YYYY')
}
</script>

<template>
  <div class="space-y-6 pb-16">
    <!-- Header & Nav -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span class="w-3 h-3 rounded-full bg-blue-600"></span>
          Dasbor Pelaporan & Rekapitulasi
        </h1>
        <p class="text-xs text-slate-500 mt-1">
          Analitik pemanfaatan cuti, kinerja persetujuan, dan pengawasan keputusan otomatis HRD.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <NuxtLink
          to="/laporan/kalender"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
        >
          <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Kalender Tim
        </NuxtLink>

        <!-- CSV Export Dropdown / Buttons -->
        <div class="inline-flex rounded-xl shadow-xs">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-l-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
            @click="downloadCsv('requests')"
          >
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ekspor CSV Pengajuan
          </button>
          <button
            type="button"
            class="px-2.5 py-2 rounded-r-xl border-l border-emerald-500 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
            title="Ekspor CSV Kuota"
            @click="downloadCsv('quota')"
          >
            Kuota
          </button>
        </div>
      </div>
    </div>

    <!-- Filter Bar: Periode & Parameter -->
    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <!-- Period Selector -->
        <div class="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg transition"
            :class="periodType === 'month' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'"
            @click="periodType = 'month'"
          >
            Bulan Ini
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg transition"
            :class="periodType === 'quarter' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'"
            @click="periodType = 'quarter'"
          >
            Kuartal Ini
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg transition"
            :class="periodType === 'year' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'"
            @click="periodType = 'year'"
          >
            Tahun Ini
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg transition"
            :class="periodType === 'custom' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'"
            @click="periodType = 'custom'"
          >
            Kustom
          </button>
        </div>

        <div class="text-xs text-slate-400">
          Periode aktif: <strong class="text-slate-700">{{ formatDate(summaryData?.period?.from) }} – {{ formatDate(summaryData?.period?.to) }}</strong>
        </div>
      </div>

      <!-- Extended Filters -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
        <!-- Departemen -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Departemen</label>
          <select
            v-model="selectedDept"
            class="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Semua Departemen</option>
            <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>

        <!-- Jenis Izin -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Jenis Izin</label>
          <select
            v-model="selectedLeaveType"
            class="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Semua Jenis Izin</option>
            <option v-for="t in leaveTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <!-- Custom Date Range -->
        <template v-if="periodType === 'custom'">
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Dari Tanggal</label>
            <input
              v-model="customFrom"
              type="date"
              class="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Sampai Tanggal</label>
            <input
              v-model="customTo"
              type="date"
              class="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </template>
      </div>
    </div>

    <!-- Ringkasan KPI Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-6 gap-3">
      <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div class="text-[11px] font-semibold text-slate-500 uppercase">Total Pengajuan</div>
        <div class="text-2xl font-black text-slate-900 mt-1">{{ summary.total || 0 }}</div>
      </div>

      <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div class="text-[11px] font-semibold text-emerald-600 uppercase">Disetujui</div>
        <div class="text-2xl font-black text-emerald-600 mt-1">{{ summary.approved || 0 }}</div>
      </div>

      <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div class="text-[11px] font-semibold text-rose-600 uppercase">Ditolak</div>
        <div class="text-2xl font-black text-rose-600 mt-1">{{ summary.rejected || 0 }}</div>
      </div>

      <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div class="text-[11px] font-semibold text-blue-600 uppercase">Sedang Berjalan</div>
        <div class="text-2xl font-black text-blue-600 mt-1">{{ summary.inReview || 0 }}</div>
      </div>

      <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div class="text-[11px] font-semibold text-purple-600 uppercase">Keputusan Otomatis</div>
        <div class="text-2xl font-black text-purple-700 mt-1">
          {{ summary.autoDecided || 0 }}
          <span class="text-xs font-normal text-purple-500">({{ summary.autoDecidedPct || 0 }}%)</span>
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div class="text-[11px] font-semibold text-slate-600 uppercase">Rata-rata Respon</div>
        <div class="text-2xl font-black text-slate-800 mt-1">
          {{ summary.avgDecisionHours || 0 }}
          <span class="text-xs font-normal text-slate-400">jam</span>
        </div>
      </div>
    </div>

    <!-- 5 Tab Navigasi Rekapitulasi -->
    <div class="border-b border-slate-200">
      <div class="flex space-x-2 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          class="py-3 px-4 border-b-2 whitespace-nowrap transition"
          :class="activeTab === 'type' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
          @click="activeTab = 'type'"
        >
          1. Rekap Per Jenis Izin ({{ byLeaveType.length }})
        </button>

        <button
          type="button"
          class="py-3 px-4 border-b-2 whitespace-nowrap transition"
          :class="activeTab === 'department' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
          @click="activeTab = 'department'"
        >
          2. Rekap Per Departemen ({{ byDepartment.length }})
        </button>

        <button
          type="button"
          class="py-3 px-4 border-b-2 whitespace-nowrap transition"
          :class="activeTab === 'quota' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
          @click="activeTab = 'quota'"
        >
          3. Sisa Kuota Pegawai ({{ quotaBalances.length }})
        </button>

        <button
          type="button"
          class="py-3 px-4 border-b-2 whitespace-nowrap transition"
          :class="activeTab === 'performance' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
          @click="activeTab = 'performance'"
        >
          4. Kinerja Approver ({{ approverPerformance.length }})
        </button>

        <button
          type="button"
          class="py-3 px-4 border-b-2 whitespace-nowrap transition"
          :class="activeTab === 'auto' ? 'border-purple-600 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'"
          @click="activeTab = 'auto'"
        >
          5. Audit Keputusan Otomatis ({{ autoDecidedList.length }})
        </button>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="pending" class="space-y-4">
      <AppSkeleton type="table" />
    </div>


    <!-- TAB 1: Rekap Per Jenis Izin -->
    <div v-if="activeTab === 'type'" class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="text-sm font-bold text-slate-900">Distribusi Pemanfaatan Berdasarkan Jenis Izin</h3>
        <span class="text-xs text-slate-400">Total Hari & Jumlah Pengajuan</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4">Jenis Izin</th>
              <th class="py-3 px-4 text-center">Kode</th>
              <th class="py-3 px-4 text-right">Pengajuan</th>
              <th class="py-3 px-4 text-right">Disetujui</th>
              <th class="py-3 px-4 text-right">Total Hari Izin</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="t in byLeaveType" :key="t.leaveTypeId" class="hover:bg-slate-50/70">
              <td class="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: t.color || '#3b82f6' }"></span>
                {{ t.name }}
              </td>
              <td class="py-3.5 px-4 text-center font-mono text-slate-500">{{ t.code }}</td>
              <td class="py-3.5 px-4 text-right font-medium">{{ t.requestCount }}</td>
              <td class="py-3.5 px-4 text-right text-emerald-600 font-semibold">{{ t.approvedCount }}</td>
              <td class="py-3.5 px-4 text-right font-bold text-slate-900">{{ t.totalDays }} hari</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: Rekap Per Departemen -->
    <div v-if="activeTab === 'department'" class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="text-sm font-bold text-slate-900">Pemanfaatan Izin Berdasarkan Departemen / Divisi</h3>
        <span class="text-xs text-slate-400">Total Hari & Rata-rata Per Pegawai</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4">Nama Departemen</th>
              <th class="py-3 px-4 text-right">Jumlah Pegawai</th>
              <th class="py-3 px-4 text-right">Total Pengajuan</th>
              <th class="py-3 px-4 text-right">Total Hari Izin</th>
              <th class="py-3 px-4 text-right">Rata-rata Hari / Pegawai</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="d in byDepartment" :key="d.departmentId" class="hover:bg-slate-50/70">
              <td class="py-3.5 px-4 font-bold text-slate-800">{{ d.departmentName }}</td>
              <td class="py-3.5 px-4 text-right text-slate-600">{{ d.employeeCount }} orang</td>
              <td class="py-3.5 px-4 text-right font-medium">{{ d.requestCount }}</td>
              <td class="py-3.5 px-4 text-right font-bold text-slate-900">{{ d.totalDays }} hari</td>
              <td class="py-3.5 px-4 text-right text-blue-600 font-semibold">{{ d.avgDaysPerEmployee }} hari/orang</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: Sisa Kuota Cuti Pegawai -->
    <div v-if="activeTab === 'quota'" class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Monitoring Sisa Kuota Cuti Pegawai</h3>
          <p class="text-[11px] text-slate-500 mt-0.5">Pegawai dengan saldo besar mendekati akhir tahun ditandai peringatan penumpukan cuti.</p>
        </div>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          @click="downloadCsv('quota')"
        >
          Unduh CSV Kuota
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4">Pegawai</th>
              <th class="py-3 px-4">Departemen</th>
              <th class="py-3 px-4 text-right">Alokasi</th>
              <th class="py-3 px-4 text-right">Terpakai</th>
              <th class="py-3 px-4 text-right">Dipesan</th>
              <th class="py-3 px-4 text-right">Sisa Kuota</th>
              <th class="py-3 px-4 text-center">Status Risiko</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="q in quotaBalances" :key="q.employeeId" class="hover:bg-slate-50/70">
              <td class="py-3 px-4">
                <div class="font-bold text-slate-900">{{ q.fullName }}</div>
                <div class="text-[11px] text-slate-400">NIP: {{ q.nip }}</div>
              </td>
              <td class="py-3 px-4 text-slate-600">{{ q.departmentName || '-' }}</td>
              <td class="py-3 px-4 text-right text-slate-500">{{ q.allocated }}</td>
              <td class="py-3 px-4 text-right text-slate-700 font-medium">{{ q.used }}</td>
              <td class="py-3 px-4 text-right text-amber-700">{{ q.reserved }}</td>
              <td class="py-3 px-4 text-right font-black text-blue-700 text-sm">{{ q.balance }}</td>
              <td class="py-3 px-4 text-center">
                <span
                  v-if="q.isYearEndRisk"
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                  title="Sisa kuota >= 8 hari mendekati akhir tahun (Q4)"
                >
                  ⚠️ Risiko Akhir Tahun
                </span>
                <span v-else class="text-slate-400 text-[11px]">Normal</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: Kinerja Approver -->
    <div v-if="activeTab === 'performance'" class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Informasi Operasional Respons Approver</h3>
          <p class="text-[11px] text-slate-500 mt-0.5">Menyajikan data beban tugas dan kecepatan respon kerja secara objektif.</p>
        </div>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          @click="downloadCsv('performance')"
        >
          Unduh CSV Kinerja
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4">Nama Approver</th>
              <th class="py-3 px-4">Departemen</th>
              <th class="py-3 px-4 text-right">Total Tugas</th>
              <th class="py-3 px-4 text-right">Disetujui</th>
              <th class="py-3 px-4 text-right">Ditolak</th>
              <th class="py-3 px-4 text-right">Lewat SLA</th>
              <th class="py-3 px-4 text-right">Rata-rata Waktu Respons</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="ap in approverPerformance" :key="ap.approverId" class="hover:bg-slate-50/70">
              <td class="py-3 px-4 font-bold text-slate-900">{{ ap.approverName }}</td>
              <td class="py-3 px-4 text-slate-600">{{ ap.departmentName || '-' }}</td>
              <td class="py-3 px-4 text-right font-semibold">{{ ap.totalTasks }}</td>
              <td class="py-3 px-4 text-right text-emerald-600 font-semibold">{{ ap.approvedCount }}</td>
              <td class="py-3 px-4 text-right text-rose-600 font-semibold">{{ ap.rejectedCount }}</td>
              <td class="py-3 px-4 text-right" :class="ap.overdueCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'">
                {{ ap.overdueCount }}
              </td>
              <td class="py-3 px-4 text-right font-medium text-slate-800">
                {{ ap.avgResponseHours !== null ? `${ap.avgResponseHours} jam` : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 5: Audit Keputusan Otomatis -->
    <div v-if="activeTab === 'auto'" class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-purple-900 flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
            Audit Pengajuan yang Diputuskan Otomatis oleh Sistem
          </h3>
          <p class="text-[11px] text-slate-500 mt-0.5">
            Pengaman HRD untuk memantau apakah ada aturan sistem yang terlalu ketat atau batas SLA yang terlewati secara massal.
          </p>
        </div>
      </div>

      <div v-if="autoDecidedList.length === 0" class="p-8 text-center text-xs text-slate-400">
        Tidak ada pengajuan yang diputuskan otomatis oleh sistem pada periode ini.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-purple-50/50 text-[11px] font-bold text-purple-900 uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4">Pengajuan</th>
              <th class="py-3 px-4">Pemohon</th>
              <th class="py-3 px-4">Jenis & Durasi</th>
              <th class="py-3 px-4 text-center">Keputusan Sistem</th>
              <th class="py-3 px-4">Alasan Keputusan Sistem</th>
              <th class="py-3 px-4 text-right">Waktu</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="ad in autoDecidedList" :key="ad.requestId" class="hover:bg-slate-50/70">
              <td class="py-3.5 px-4 font-bold text-slate-900">
                <NuxtLink :to="`/admin/pengajuan/${ad.requestId}`" class="hover:text-blue-600 hover:underline">
                  #{{ ad.requestNumber }}
                </NuxtLink>
              </td>
              <td class="py-3.5 px-4">
                <div class="font-semibold text-slate-800">{{ ad.employeeName }}</div>
                <div class="text-[11px] text-slate-400">{{ ad.departmentName }}</div>
              </td>
              <td class="py-3.5 px-4">
                <div class="font-medium text-slate-800">{{ ad.leaveTypeName }}</div>
                <div class="text-[11px] text-slate-500">{{ ad.totalDays }} hari</div>
              </td>
              <td class="py-3.5 px-4 text-center">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                  :class="ad.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
                >
                  {{ ad.status }}
                </span>
              </td>
              <td class="py-3.5 px-4 max-w-xs text-slate-600 italic">
                "{{ ad.decisionReason || 'Diputuskan otomatis sesuai aturan alur' }}"
              </td>
              <td class="py-3.5 px-4 text-right text-slate-400 whitespace-nowrap">
                {{ formatDate(ad.decidedAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
