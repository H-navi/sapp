<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Pengaturan Sistem',
})

const activeTab = ref<'hours' | 'holidays' | 'settings'>('hours')

// --- DATA FETCHING ---
const { data: hoursData, refresh: refreshHours } = await useFetch<{ data: any[] }>('/api/admin/working-hours')
const { data: holidaysData, refresh: refreshHolidays } = await useFetch<{ data: any[] }>('/api/admin/holidays')
const { data: settingsData, refresh: refreshSettings } = await useFetch<{ data: any[] }>('/api/admin/settings')

// --- JAM KERJA LOGIC ---
const dayNames: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
}

interface WorkingHourItem {
  dayOfWeek: number
  isWorkingDay: boolean
  startTime: string
  endTime: string
  breakStart: string | null
  breakEnd: string | null
}

const workingHoursList = ref<WorkingHourItem[]>([])

watch(
  () => hoursData.value?.data,
  (serverHours) => {
    const map = new Map<number, any>()
    if (serverHours) {
      serverHours.forEach((h: any) => map.set(h.dayOfWeek, h))
    }
    const list: WorkingHourItem[] = []
    for (let day = 1; day <= 7; day++) {
      const existing = map.get(day)
      if (existing) {
        list.push({
          dayOfWeek: day,
          isWorkingDay: Boolean(existing.isWorkingDay),
          startTime: (existing.startTime || '08:00').substring(0, 5),
          endTime: (existing.endTime || '17:00').substring(0, 5),
          breakStart: existing.breakStart ? existing.breakStart.substring(0, 5) : '12:00',
          breakEnd: existing.breakEnd ? existing.breakEnd.substring(0, 5) : '13:00',
        })
      } else {
        const isWeekday = day <= 5
        list.push({
          dayOfWeek: day,
          isWorkingDay: isWeekday,
          startTime: '08:00',
          endTime: '17:00',
          breakStart: isWeekday ? '12:00' : null,
          breakEnd: isWeekday ? '13:00' : null,
        })
      }
    }
    workingHoursList.value = list
  },
  { immediate: true }
)

const savingDay = ref<number | null>(null)
const hoursFeedback = ref<{ day: number; message: string; isError?: boolean } | null>(null)

async function saveWorkingHour(item: WorkingHourItem) {
  savingDay.value = item.dayOfWeek
  hoursFeedback.value = null
  try {
    await $fetch('/api/admin/working-hours', {
      method: 'PUT',
      body: {
        dayOfWeek: item.dayOfWeek,
        isWorkingDay: item.isWorkingDay,
        startTime: item.startTime,
        endTime: item.endTime,
        breakStart: item.breakStart || null,
        breakEnd: item.breakEnd || null,
      },
    })
    hoursFeedback.value = {
      day: item.dayOfWeek,
      message: 'Jam kerja berhasil disimpan.',
    }
    await refreshHours()
    setTimeout(() => {
      if (hoursFeedback.value?.day === item.dayOfWeek) {
        hoursFeedback.value = null
      }
    }, 3000)
  } catch (err: any) {
    hoursFeedback.value = {
      day: item.dayOfWeek,
      message: err?.data?.message || err?.statusMessage || 'Gagal menyimpan.',
      isError: true,
    }
  } finally {
    savingDay.value = null
  }
}

// --- HARI LIBUR LOGIC ---
const holidays = computed(() => holidaysData.value?.data ?? [])

const holidayModalOpen = ref(false)
const holidayForm = reactive({
  holidayDate: '',
  name: '',
  type: 'NATIONAL' as 'NATIONAL' | 'JOINT_LEAVE' | 'COMPANY',
  deductsQuota: false,
})
const holidayError = ref('')
const holidaySaving = ref(false)

function openAddHoliday() {
  holidayForm.holidayDate = dayjs().format('YYYY-MM-DD')
  holidayForm.name = ''
  holidayForm.type = 'NATIONAL'
  holidayForm.deductsQuota = false
  holidayError.value = ''
  holidayModalOpen.value = true
}

async function handleSaveHoliday() {
  holidayError.value = ''
  holidaySaving.value = true
  try {
    await $fetch('/api/admin/holidays', {
      method: 'POST',
      body: {
        holidayDate: holidayForm.holidayDate,
        name: holidayForm.name,
        type: holidayForm.type,
        deductsQuota: holidayForm.deductsQuota,
      },
    })
    holidayModalOpen.value = false
    await refreshHolidays()
  } catch (err: any) {
    holidayError.value = err?.data?.message || err?.statusMessage || 'Gagal menambahkan hari libur.'
  } finally {
    holidaySaving.value = false
  }
}

const deleteModalOpen = ref(false)
const holidayToDelete = ref<any>(null)
const deletingHoliday = ref(false)

function confirmDeleteHoliday(h: any) {
  holidayToDelete.value = h
  deleteModalOpen.value = true
}

async function executeDeleteHoliday() {
  if (!holidayToDelete.value) return
  deletingHoliday.value = true
  try {
    await $fetch(`/api/admin/holidays/${holidayToDelete.value.id}`, {
      method: 'DELETE',
    })
    deleteModalOpen.value = false
    holidayToDelete.value = null
    await refreshHolidays()
  } catch (err: any) {
    alert(err?.data?.message || 'Gagal menghapus hari libur.')
  } finally {
    deletingHoliday.value = false
  }
}

function holidayTypeBadge(type: string) {
  switch (type) {
    case 'NATIONAL':
      return { label: 'Libur Nasional', class: 'bg-red-50 text-red-700 border-red-200' }
    case 'JOINT_LEAVE':
      return { label: 'Cuti Bersama', class: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'COMPANY':
      return { label: 'Libur Perusahaan', class: 'bg-blue-50 text-blue-700 border-blue-200' }
    default:
      return { label: type, class: 'bg-slate-50 text-slate-700 border-slate-200' }
  }
}

// --- PENGATURAN SISTEM LOGIC ---
const systemSettings = computed(() => settingsData.value?.data ?? [])

const settingModalOpen = ref(false)
const editingSetting = ref<any>(null)
const settingForm = reactive({
  key: '',
  valueText: '',
  groupName: 'general',
  description: '',
})
const settingError = ref('')
const settingSaving = ref(false)

function openEditSetting(s: any) {
  editingSetting.value = s
  settingForm.key = s.key
  settingForm.valueText = typeof s.value === 'object' ? JSON.stringify(s.value, null, 2) : String(s.value ?? '')
  settingForm.groupName = s.groupName || 'general'
  settingForm.description = s.description || ''
  settingError.value = ''
  settingModalOpen.value = true
}

function openAddSetting() {
  editingSetting.value = null
  settingForm.key = ''
  settingForm.valueText = ''
  settingForm.groupName = 'general'
  settingForm.description = ''
  settingError.value = ''
  settingModalOpen.value = true
}

async function handleSaveSetting() {
  settingError.value = ''
  settingSaving.value = true
  try {
    let parsedValue: unknown = settingForm.valueText
    // Coba parse JSON jika valid JSON
    try {
      parsedValue = JSON.parse(settingForm.valueText)
    } catch {
      // Jika bukan JSON, cek tipe primitif
      if (settingForm.valueText === 'true') parsedValue = true
      else if (settingForm.valueText === 'false') parsedValue = false
      else if (!isNaN(Number(settingForm.valueText)) && settingForm.valueText.trim() !== '') {
        parsedValue = Number(settingForm.valueText)
      }
    }

    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        key: settingForm.key,
        value: parsedValue,
      },
    })
    settingModalOpen.value = false
    await refreshSettings()
  } catch (err: any) {
    settingError.value = err?.data?.message || err?.statusMessage || 'Gagal menyimpan pengaturan.'
  } finally {
    settingSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="Pengaturan Sistem"
      description="Konfigurasi jam operasional kerja, kalender hari libur, dan parameter sistem."
    >
      <template #actions>
        <button
          v-if="activeTab === 'holidays'"
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition"
          @click="openAddHoliday"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Tambah Hari Libur
        </button>

        <button
          v-if="activeTab === 'settings'"
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition"
          @click="openAddSetting"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Tambah Parameter
        </button>
      </template>
    </AppPageHeader>

    <!-- Tabs Navigation (Mobile First) -->
    <div class="flex border-b border-slate-200">
      <button
        type="button"
        class="flex-1 py-3 px-2 text-center text-sm font-medium border-b-2 transition"
        :class="
          activeTab === 'hours'
            ? 'border-blue-600 text-blue-600 font-semibold'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        "
        @click="activeTab = 'hours'"
      >
        Jam Kerja
      </button>
      <button
        type="button"
        class="flex-1 py-3 px-2 text-center text-sm font-medium border-b-2 transition"
        :class="
          activeTab === 'holidays'
            ? 'border-blue-600 text-blue-600 font-semibold'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        "
        @click="activeTab = 'holidays'"
      >
        Hari Libur
      </button>
      <button
        type="button"
        class="flex-1 py-3 px-2 text-center text-sm font-medium border-b-2 transition"
        :class="
          activeTab === 'settings'
            ? 'border-blue-600 text-blue-600 font-semibold'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        "
        @click="activeTab = 'settings'"
      >
        Parameter Sistem
      </button>
    </div>

    <!-- TAB 1: JAM KERJA -->
    <div v-if="activeTab === 'hours'" class="space-y-4">
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
        <svg class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <strong>Pengaruh Aturan Kerja:</strong> Perubahan jam kerja memengaruhi perhitungan SLA approval dan fungsi perhitungan hari kerja efektif pada seluruh pengajuan izin pegawai.
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="item in workingHoursList"
          :key="item.dayOfWeek"
          class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 transition"
          :class="{ 'opacity-80 bg-slate-50': !item.isWorkingDay }"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="font-bold text-slate-900 text-base">{{ dayNames[item.dayOfWeek] }}</span>
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="item.isWorkingDay ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'"
              >
                {{ item.isWorkingDay ? 'Hari Kerja' : 'Libur' }}
              </span>
            </div>
            <AppToggle
              v-model="item.isWorkingDay"
              :label="item.isWorkingDay ? 'Aktif' : 'Libur'"
            />
          </div>

          <div v-if="item.isWorkingDay" class="space-y-3 pt-2 border-t border-slate-100">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Jam Masuk</label>
                <input
                  v-model="item.startTime"
                  type="time"
                  class="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Jam Pulang</label>
                <input
                  v-model="item.endTime"
                  type="time"
                  class="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Istirahat Mulai</label>
                <input
                  v-model="item.breakStart"
                  type="time"
                  class="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Istirahat Selesai</label>
                <input
                  v-model="item.breakEnd"
                  type="time"
                  class="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2">
            <div class="text-xs">
              <span
                v-if="hoursFeedback?.day === item.dayOfWeek"
                :class="hoursFeedback.isError ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'"
              >
                {{ hoursFeedback.message }}
              </span>
            </div>

            <button
              type="button"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50"
              :disabled="savingDay === item.dayOfWeek"
              @click="saveWorkingHour(item)"
            >
              {{ savingDay === item.dayOfWeek ? 'Menyimpan...' : 'Simpan Perubahan' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: HARI LIBUR -->
    <div v-if="activeTab === 'holidays'" class="space-y-4">
      <AppEmptyState
        v-if="holidays.length === 0"
        title="Belum ada hari libur"
        description="Daftar hari libur nasional atau cuti bersama belum ditentukan."
      />

      <div v-else class="space-y-2.5">
        <div
          v-for="h in holidays"
          :key="h.id"
          class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start justify-between gap-3"
        >
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                class="text-xs px-2 py-0.5 rounded-full font-semibold border"
                :class="holidayTypeBadge(h.type).class"
              >
                {{ holidayTypeBadge(h.type).label }}
              </span>
              <span
                v-if="h.deductsQuota"
                class="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-700 border border-purple-200"
              >
                Potong Kuota
              </span>
            </div>
            <h4 class="font-bold text-slate-900 text-sm sm:text-base">{{ h.name }}</h4>
            <p class="text-xs text-slate-500">
              📅 {{ dayjs(h.holidayDate).format('DD MMMM YYYY') }}
            </p>
          </div>

          <button
            type="button"
            class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Hapus Hari Libur"
            @click="confirmDeleteHoliday(h)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 3: PENGATURAN SISTEM -->
    <div v-if="activeTab === 'settings'" class="space-y-4">
      <AppEmptyState
        v-if="systemSettings.length === 0"
        title="Belum ada parameter sistem"
        description="Belum ada catatan konfigurasi sistem yang tersimpan."
      />

      <div v-else class="space-y-3">
        <div
          v-for="s in systemSettings"
          :key="s.key"
          class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start justify-between gap-3"
        >
          <div class="space-y-1.5 flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                {{ s.groupName }}
              </span>
              <span class="text-xs font-mono font-bold text-blue-700 truncate">{{ s.key }}</span>
            </div>
            <p v-if="s.description" class="text-xs text-slate-500">{{ s.description }}</p>
            <div class="p-2 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-slate-800 break-all">
              {{ typeof s.value === 'object' ? JSON.stringify(s.value) : s.value }}
            </div>
          </div>

          <button
            type="button"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition shrink-0"
            @click="openEditSetting(s)"
          >
            Ubah
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: Tambah Hari Libur -->
    <div
      v-if="holidayModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div class="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <h3 class="font-bold text-slate-900 text-lg">Tambah Hari Libur</h3>

        <div v-if="holidayError" class="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
          {{ holidayError }}
        </div>

        <form class="space-y-3" @submit.prevent="handleSaveHoliday">
          <AppFormField label="Tanggal Libur" required>
            <input
              v-model="holidayForm.holidayDate"
              type="date"
              required
              class="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </AppFormField>

          <AppFormField label="Nama Hari Libur" required>
            <input
              v-model="holidayForm.name"
              type="text"
              required
              placeholder="e.g. Hari Raya Idul Fitri"
              class="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </AppFormField>

          <AppFormField label="Jenis Hari Libur" required>
            <select
              v-model="holidayForm.type"
              class="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="NATIONAL">Libur Nasional</option>
              <option value="JOINT_LEAVE">Cuti Bersama</option>
              <option value="COMPANY">Libur Khusus Perusahaan</option>
            </select>
          </AppFormField>

          <div class="pt-1">
            <AppToggle
              v-model="holidayForm.deductsQuota"
              label="Memotong Kuota Cuti Tahunan"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
              @click="holidayModalOpen = false"
            >
              Batal
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
              :disabled="holidaySaving"
            >
              {{ holidaySaving ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: Edit Setting -->
    <div
      v-if="settingModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div class="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <h3 class="font-bold text-slate-900 text-lg">
          {{ editingSetting ? 'Ubah Parameter' : 'Tambah Parameter' }}
        </h3>

        <div v-if="settingError" class="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
          {{ settingError }}
        </div>

        <form class="space-y-3" @submit.prevent="handleSaveSetting">
          <AppFormField label="Kunci (Key)" required>
            <input
              v-model="settingForm.key"
              type="text"
              :disabled="Boolean(editingSetting)"
              required
              placeholder="e.g. sla.approval_hours"
              class="w-full text-sm font-mono rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </AppFormField>

          <AppFormField label="Nilai (String / Number / JSON)" required>
            <textarea
              v-model="settingForm.valueText"
              rows="3"
              required
              placeholder="Nilai pengaturan atau JSON"
              class="w-full text-sm font-mono rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </AppFormField>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
              @click="settingModalOpen = false"
            >
              Batal
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
              :disabled="settingSaving"
            >
              {{ settingSaving ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- DIALOG KONFIRMASI HAPUS HARI LIBUR -->
    <AppConfirmDialog
      :is-open="deleteModalOpen"
      title="Hapus Hari Libur?"
      :message="`Apakah Anda yakin ingin menghapus '${holidayToDelete?.name}' dari daftar kalender libur? Tindakan ini tidak dapat dibatalkan.`"
      confirm-text="Hapus"
      :is-danger="true"
      :is-loading="deletingHoliday"
      @confirm="executeDeleteHoliday"
      @cancel="deleteModalOpen = false"
    />
  </div>
</template>
