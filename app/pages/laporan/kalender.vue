<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Kalender Izin Tim · Sistem Perizinan Pegawai',
})

const currentMonth = ref(dayjs().format('YYYY-MM'))
const selectedDept = ref('')
const selectedDateDetail = ref<string | null>(null)

// Fetch Calendar Data
const { data: res, pending, refresh } = await useFetch<{ data: any }>('/api/reports/calendar', {
  query: computed(() => ({
    month: currentMonth.value,
    department_id: selectedDept.value || undefined,
  })),
})

const calendarData = computed(() => res.value?.data)
const holidays = computed(() => calendarData.value?.holidays || [])
const leaves = computed(() => calendarData.value?.leaves || [])
const departments = computed(() => calendarData.value?.departments || [])

// Month navigation
function prevMonth() {
  currentMonth.value = dayjs(currentMonth.value, 'YYYY-MM').subtract(1, 'month').format('YYYY-MM')
}

function nextMonth() {
  currentMonth.value = dayjs(currentMonth.value, 'YYYY-MM').add(1, 'month').format('YYYY-MM')
}

function goToToday() {
  currentMonth.value = dayjs().format('YYYY-MM')
}

// Map dates to holidays and leaves
const holidayMap = computed(() => {
  const map: Record<string, any[]> = {}
  for (const h of holidays.value) {
    if (!map[h.date]) map[h.date] = []
    map[h.date].push(h)
  }
  return map
})

const leaveMap = computed(() => {
  const map: Record<string, any[]> = {}
  for (const l of leaves.value) {
    if (!map[l.date]) map[l.date] = []
    map[l.date].push(l)
  }
  return map
})

// Build Desktop Grid Days (including padding from Monday)
const desktopGridDays = computed(() => {
  const base = dayjs(currentMonth.value, 'YYYY-MM')
  const startOfMonth = base.startOf('month')
  const endOfMonth = base.endOf('month')
  const daysInMonth = base.daysInMonth()

  // Day of week: 0 (Sun) to 6 (Sat). We want Monday (1) as first day of week: (d + 6) % 7
  const startWeekday = (startOfMonth.day() + 6) % 7

  const grid: any[] = []

  // Pre-padding from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = startOfMonth.subtract(i + 1, 'day')
    grid.push({
      dateStr: d.format('YYYY-MM-DD'),
      dayNum: d.date(),
      isCurrentMonth: false,
      isWeekend: d.day() === 0 || d.day() === 6,
      isToday: d.isSame(dayjs(), 'day'),
      holidays: [],
      leaves: [],
    })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = base.date(d)
    const dateStr = dateObj.format('YYYY-MM-DD')
    grid.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isWeekend: dateObj.day() === 0 || dateObj.day() === 6,
      isToday: dateObj.isSame(dayjs(), 'day'),
      holidays: holidayMap.value[dateStr] || [],
      leaves: leaveMap.value[dateStr] || [],
    })
  }

  // Post-padding to complete 7-day row
  const remaining = (7 - (grid.length % 7)) % 7
  for (let i = 1; i <= remaining; i++) {
    const d = endOfMonth.add(i, 'day')
    grid.push({
      dateStr: d.format('YYYY-MM-DD'),
      dayNum: d.date(),
      isCurrentMonth: false,
      isWeekend: d.day() === 0 || d.day() === 6,
      isToday: d.isSame(dayjs(), 'day'),
      holidays: [],
      leaves: [],
    })
  }

  return grid
})

// Build Mobile Daily List (all days in month, ordered)
const mobileDaysList = computed(() => {
  const base = dayjs(currentMonth.value, 'YYYY-MM')
  const daysInMonth = base.daysInMonth()
  const list: any[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = base.date(d)
    const dateStr = dateObj.format('YYYY-MM-DD')
    list.push({
      dateStr,
      dayNum: d,
      dayName: dateObj.format('dddd'),
      formattedDate: dateObj.format('D MMMM YYYY'),
      isWeekend: dateObj.day() === 0 || dateObj.day() === 6,
      isToday: dateObj.isSame(dayjs(), 'day'),
      holidays: holidayMap.value[dateStr] || [],
      leaves: leaveMap.value[dateStr] || [],
    })
  }
  return list
})

// Modal Detail Hari
const activeDayDetail = computed(() => {
  if (!selectedDateDetail.value) return null
  const dateObj = dayjs(selectedDateDetail.value)
  const dateStr = selectedDateDetail.value
  return {
    dateStr,
    title: dateObj.format('dddd, D MMMM YYYY'),
    isWeekend: dateObj.day() === 0 || dateObj.day() === 6,
    holidays: holidayMap.value[dateStr] || [],
    leaves: leaveMap.value[dateStr] || [],
  }
})
</script>

<template>
  <div class="space-y-6 pb-16">
    <!-- Header & Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span class="w-3 h-3 rounded-full bg-blue-600"></span>
          Kalender Izin Tim
        </h1>
        <p class="text-xs text-slate-500 mt-1">
          Pantau ketersediaan rekan kerja, potensi tumpukan izin bersamaan, dan hari libur nasional.
        </p>
      </div>

      <!-- Controls: Month Selector & Department Filter -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Departemen Filter (Jika berhak) -->
        <select
          v-if="departments.length > 0"
          v-model="selectedDept"
          class="text-xs rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Semua Departemen</option>
          <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>

        <!-- Navigation Buttons -->
        <div class="inline-flex items-center bg-white border border-slate-200 rounded-xl shadow-xs p-1">
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
            title="Bulan Sebelumnya"
            @click="prevMonth"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span class="px-3 text-xs font-bold text-slate-800 min-w-[120px] text-center">
            {{ dayjs(currentMonth, 'YYYY-MM').format('MMMM YYYY') }}
          </span>

          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
            title="Bulan Berikutnya"
            @click="nextMonth"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          @click="goToToday"
        >
          Hari Ini
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="p-12 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
      <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      Memuat kalender izin...
    </div>

    <div v-else>
      <!-- TAMPILAN MOBILE: DAFTAR PER HARI (< 768px) -->
      <div class="block md:hidden space-y-3">
        <div
          v-for="day in mobileDaysList"
          :key="day.dateStr"
          class="p-3.5 rounded-2xl border transition-all"
          :class="[
            day.isToday ? 'bg-blue-50/50 border-blue-200 shadow-xs' :
            day.holidays.length > 0 ? 'bg-rose-50/40 border-rose-200' :
            day.isWeekend ? 'bg-slate-50/60 border-slate-200' :
            'bg-white border-slate-200'
          ]"
        >
          <!-- Date Header -->
          <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
            <div class="flex items-center gap-2">
              <span
                class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                :class="day.isToday ? 'bg-blue-600 text-white' : day.holidays.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'"
              >
                {{ day.dayNum }}
              </span>
              <div>
                <span class="text-xs font-bold text-slate-800">{{ day.dayName }}</span>
                <span v-if="day.isToday" class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">Hari Ini</span>
              </div>
            </div>

            <!-- Holiday / Weekend Badge -->
            <div v-if="day.holidays.length > 0">
              <span
                v-for="(h, idx) in day.holidays"
                :key="idx"
                class="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full"
              >
                {{ h.name }}
              </span>
            </div>
            <div v-else-if="day.isWeekend" class="text-[11px] text-slate-400">
              Akhir Pekan
            </div>
          </div>

          <!-- Leave Entries on this day -->
          <div v-if="day.leaves.length === 0" class="text-[11px] text-slate-400 py-1">
            Tidak ada pegawai yang berizin pada tanggal ini.
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="l in day.leaves"
              :key="l.id"
              class="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
            >
              <div class="flex items-center gap-2">
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: l.leaveTypeColor || '#3b82f6' }"
                ></span>
                <div>
                  <span class="font-semibold text-slate-900">{{ l.fullName }}</span>
                  <span class="text-[11px] text-slate-400 block">{{ l.departmentName }}</span>
                </div>
              </div>

              <div class="text-right">
                <span class="text-[11px] font-medium text-slate-700 block">{{ l.leaveTypeName }}</span>
                <span
                  class="text-[10px] px-1.5 py-0.2 rounded font-semibold"
                  :class="l.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'"
                >
                  {{ l.status === 'APPROVED' ? 'Disetujui' : 'Menunggu' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAMPILAN DESKTOP: KISI BULANAN (>= 768px) -->
      <div class="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <!-- Weekday Headers (Senin - Minggu) -->
        <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-600 py-3">
          <div>Senin</div>
          <div>Selasa</div>
          <div>Rabu</div>
          <div>Kamis</div>
          <div>Jumat</div>
          <div class="text-rose-500">Sabtu</div>
          <div class="text-rose-500">Minggu</div>
        </div>

        <!-- Grid Days -->
        <div class="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
          <div
            v-for="(cell, idx) in desktopGridDays"
            :key="idx"
            class="min-h-[110px] p-2 flex flex-col justify-between transition-colors hover:bg-slate-50/80 cursor-pointer group"
            :class="[
              !cell.isCurrentMonth ? 'bg-slate-50/50 opacity-40' :
              cell.isToday ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200' :
              cell.holidays.length > 0 ? 'bg-rose-50/25' :
              cell.isWeekend ? 'bg-slate-50/40' : 'bg-white'
            ]"
            @click="selectedDateDetail = cell.dateStr"
          >
            <!-- Top: Day Number & Badges -->
            <div class="flex items-start justify-between gap-1">
              <span
                class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                :class="[
                  cell.isToday ? 'bg-blue-600 text-white shadow-xs' :
                  cell.holidays.length > 0 ? 'text-rose-600' :
                  cell.isWeekend ? 'text-slate-400' : 'text-slate-700'
                ]"
              >
                {{ cell.dayNum }}
              </span>

              <!-- Holiday Label -->
              <span
                v-if="cell.holidays.length > 0"
                class="text-[9px] font-bold text-rose-700 bg-rose-100/90 px-1.5 py-0.5 rounded truncate max-w-[85px]"
                :title="cell.holidays.map((h: any) => h.name).join(', ')"
              >
                {{ cell.holidays[0].name }}
              </span>
            </div>

            <!-- Middle: Leave Badges / Chips -->
            <div class="space-y-1 my-1 flex-1 overflow-hidden">
              <div
                v-for="l in cell.leaves.slice(0, 3)"
                :key="l.id"
                class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate text-slate-800"
                :style="{ backgroundColor: (l.leaveTypeColor || '#3b82f6') + '22', borderLeft: `2.5px solid ${l.leaveTypeColor || '#3b82f6'}` }"
                :title="`${l.fullName} (${l.leaveTypeName}) - ${l.departmentName}`"
              >
                <span class="truncate">{{ l.fullName }}</span>
              </div>

              <!-- More indicator -->
              <div v-if="cell.leaves.length > 3" class="text-[9px] font-bold text-slate-500 pl-1">
                +{{ cell.leaves.length - 3 }} lainnya
              </div>
            </div>

            <!-- Bottom: Total leaves on this day -->
            <div v-if="cell.leaves.length > 0" class="text-[10px] text-slate-400 text-right">
              {{ cell.leaves.length }} orang
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL DETAIL HARI (Ketika sel kalender desktop diklik) -->
    <Teleport to="body">
      <div
        v-if="activeDayDetail"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      >
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="font-bold text-slate-900 text-base">
                {{ activeDayDetail.title }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">Daftar pegawai yang berizin pada tanggal ini</p>
            </div>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 text-sm p-1"
              @click="selectedDateDetail = null"
            >
              ✕
            </button>
          </div>

          <!-- Hari Libur Nasional Jika Ada -->
          <div v-if="activeDayDetail.holidays.length > 0" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
            <span class="font-bold">Hari Libur / Cuti Bersama:</span>
            <div v-for="(h, idx) in activeDayDetail.holidays" :key="idx" class="font-medium">
              • {{ h.name }}
            </div>
          </div>

          <!-- Daftar Pegawai Berizin -->
          <div v-if="activeDayDetail.leaves.length === 0" class="py-6 text-center text-xs text-slate-400">
            Tidak ada permohonan izin pada tanggal ini.
          </div>

          <div v-else class="space-y-2 max-h-72 overflow-y-auto pr-1">
            <div
              v-for="l in activeDayDetail.leaves"
              :key="l.id"
              class="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
            >
              <div class="flex items-center gap-2.5">
                <span
                  class="w-3 h-3 rounded-full shrink-0"
                  :style="{ backgroundColor: l.leaveTypeColor || '#3b82f6' }"
                ></span>
                <div>
                  <div class="font-bold text-slate-900">{{ l.fullName }}</div>
                  <div class="text-[11px] text-slate-400">NIP {{ l.nip }} · {{ l.departmentName }}</div>
                </div>
              </div>

              <div class="text-right">
                <div class="font-semibold text-slate-700">{{ l.leaveTypeName }}</div>
                <span
                  class="inline-block text-[10px] px-2 py-0.2 rounded font-bold mt-0.5"
                  :class="l.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'"
                >
                  {{ l.status === 'APPROVED' ? 'Disetujui' : 'Dalam Proses' }}
                </span>
              </div>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 text-right">
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              @click="selectedDateDetail = null"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
