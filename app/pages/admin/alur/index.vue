<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Alur Persetujuan Bertingkat · Admin',
})

const { data: res, pending, refresh } = await useFetch<{ data: any[] }>('/api/admin/workflows')
const workflows = computed(() => res.value?.data ?? [])

// Master data untuk formulir alur baru
const { data: deptRes } = await useFetch<{ data: any[] }>('/api/admin/departments')
const departments = computed(() => deptRes.value?.data ?? [])

const { data: ltRes } = await useFetch<{ data: any[] }>('/api/admin/leave-types')
const leaveTypes = computed(() => ltRes.value?.data ?? [])

// Modal Tambah Alur Baru
const showAddModal = ref(false)
const isSubmitting = ref(false)
const formError = ref<string | null>(null)

const form = reactive({
  code: '',
  name: '',
  description: '',
  priority: 50,
  leaveTypeId: '',
  departmentId: '',
  minDays: '',
  maxDays: '',
  isActive: true,
})

function openAddModal() {
  form.code = ''
  form.name = ''
  form.description = ''
  form.priority = 50
  form.leaveTypeId = ''
  form.departmentId = ''
  form.minDays = ''
  form.maxDays = ''
  form.isActive = true
  formError.value = null
  showAddModal.value = true
}

async function handleCreateWorkflow() {
  if (!form.code.trim() || !form.name.trim()) {
    formError.value = 'Kode dan Nama Alur wajib diisi.'
    return
  }

  isSubmitting.value = true
  formError.value = null

  try {
    const res = await $fetch<{ data: any }>('/api/admin/workflows', {
      method: 'POST',
      body: {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priority: Number(form.priority) || 50,
        leaveTypeId: form.leaveTypeId || null,
        departmentId: form.departmentId || null,
        minDays: form.minDays ? Number(form.minDays) : null,
        maxDays: form.maxDays ? Number(form.maxDays) : null,
        isActive: form.isActive,
      },
    })

    showAddModal.value = false
    await refresh()
    // Arahkan langsung ke editor alur untuk menyusun tahap
    if (res?.data?.id) {
      navigateTo(`/admin/alur/${res.data.id}`)
    }
  } catch (err: any) {
    formError.value = err?.data?.message || err?.message || 'Gagal membuat alur persetujuan.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Header Navigasi -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <NuxtLink to="/admin" class="hover:text-brand-600 transition-colors flex items-center gap-1">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Dasbor Admin
          </NuxtLink>
          <span>/</span>
          <span class="text-slate-700">Alur Persetujuan</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
          Alur Persetujuan Bertingkat (Workflow Builder)
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 sm:text-sm">
          Konfigurasi hierarki approval dinamis, mode (Any One, All, Quorum), SLA, eskalasi, dan simulasi penugasan.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-primary text-xs sm:text-sm flex items-center gap-1.5 shadow-sm"
          @click="openAddModal"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Tambah Alur Baru
        </button>
      </div>
    </div>

    <!-- Ringkasan Statistik -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="card p-4">
        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Alur</p>
        <p class="mt-1 text-2xl font-black text-slate-900">{{ workflows.length }}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Tersimpan di database</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Alur Aktif</p>
        <p class="mt-1 text-2xl font-black text-emerald-600">
          {{ workflows.filter((w) => w.isActive).length }}
        </p>
        <p class="text-[11px] text-slate-400 mt-0.5">Berjalan otomatis</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipe Approver</p>
        <p class="mt-1 text-2xl font-black text-brand-600">7 Tipe</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Manager, HR, Posisi, Kuorum</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mesin Pencocokan</p>
        <p class="mt-1 text-lg font-black text-indigo-600 truncate">Spesifisitas Tinggi</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Prioritas & kriteria presisi</p>
      </div>
    </div>

    <!-- Daftar Alur Persetujuan -->
    <div class="card overflow-hidden shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3 sm:px-6 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-slate-900">Daftar Matriks Alur Persetujuan</h2>
          <p class="text-xs text-slate-500">
            Sistem mencocokkan tepat 1 alur dengan prioritas dan spesifisitas tertinggi untuk tiap pengajuan.
          </p>
        </div>
      </div>

      <div v-if="pending && workflows.length === 0" class="p-8 text-center text-slate-400 text-sm">
        <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent mb-2"></div>
        <p>Memuat alur persetujuan...</p>
      </div>

      <div v-else-if="workflows.length === 0" class="p-8 text-center text-slate-400 text-sm">
        Belum ada alur persetujuan yang dibuat.
      </div>

      <!-- Tampilan Desktop -->
      <div v-else class="hidden md:block overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th class="px-5 py-3.5 font-semibold text-center w-16">Prioritas</th>
              <th class="px-5 py-3.5 font-semibold">Alur Persetujuan</th>
              <th class="px-5 py-3.5 font-semibold">Kriteria Penentuan</th>
              <th class="px-5 py-3.5 font-semibold text-center">Tahap</th>
              <th class="px-5 py-3.5 font-semibold text-center">Status</th>
              <th class="px-5 py-3.5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="wf in workflows"
              :key="wf.id"
              class="hover:bg-slate-50/80 transition-colors"
            >
              <td class="px-5 py-4 text-center">
                <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 font-bold text-slate-700 text-xs">
                  {{ wf.priority }}
                </span>
              </td>

              <td class="px-5 py-4">
                <div class="font-bold text-slate-900 text-sm">{{ wf.name }}</div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-[10px] text-slate-400 uppercase font-semibold">#{{ wf.code }}</span>
                  <span class="text-[10px] text-slate-400">v{{ wf.version }}</span>
                </div>
                <p v-if="wf.description" class="text-[11px] text-slate-500 mt-1 line-clamp-1">
                  {{ wf.description }}
                </p>
              </td>

              <td class="px-5 py-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span
                      class="badge text-[10px] text-white font-medium"
                      :style="{ backgroundColor: wf.leaveTypeColor || '#64748B' }"
                    >
                      {{ wf.leaveTypeName }}
                    </span>
                    <span class="badge bg-slate-100 text-slate-700 text-[10px]">
                      {{ wf.departmentName }}
                    </span>
                  </div>
                  <div v-if="wf.minDays != null || wf.maxDays != null" class="text-[11px] text-slate-500">
                    Durasi:
                    <span v-if="wf.minDays != null">&ge; {{ wf.minDays }} hari</span>
                    <span v-if="wf.minDays != null && wf.maxDays != null"> dan </span>
                    <span v-if="wf.maxDays != null">&le; {{ wf.maxDays }} hari</span>
                  </div>
                </div>
              </td>

              <td class="px-5 py-4 text-center">
                <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                  {{ wf.stepsCount }} Tahap
                </span>
              </td>

              <td class="px-5 py-4 text-center">
                <span
                  class="badge text-[10px] font-bold"
                  :class="wf.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'"
                >
                  {{ wf.isActive ? 'Aktif' : 'Nonaktif' }}
                </span>
              </td>

              <td class="px-5 py-4 text-right">
                <NuxtLink
                  :to="`/admin/alur/${wf.id}`"
                  class="btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Kelola Tahap
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tampilan Mobile -->
      <div v-if="workflows.length > 0" class="md:hidden divide-y divide-slate-100">
        <div
          v-for="wf in workflows"
          :key="wf.id"
          class="p-4 space-y-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="badge bg-slate-100 text-slate-700 font-bold text-[10px]">Prio {{ wf.priority }}</span>
                <span
                  class="badge text-[10px] font-bold"
                  :class="wf.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                >
                  {{ wf.isActive ? 'Aktif' : 'Nonaktif' }}
                </span>
              </div>
              <h3 class="text-sm font-bold text-slate-900 mt-1">{{ wf.name }}</h3>
              <p class="text-[10px] font-mono text-slate-400 uppercase font-semibold">#{{ wf.code }}</p>
            </div>

            <span class="badge bg-brand-50 text-brand-700 font-bold text-xs flex-shrink-0">
              {{ wf.stepsCount }} Tahap
            </span>
          </div>

          <div class="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-100">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Jenis Izin:</span>
              <span class="font-medium text-slate-800">{{ wf.leaveTypeName }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Departemen:</span>
              <span class="font-medium text-slate-800">{{ wf.departmentName }}</span>
            </div>
            <div v-if="wf.minDays != null || wf.maxDays != null" class="flex items-center justify-between">
              <span class="text-slate-500">Batas Durasi:</span>
              <span class="font-medium text-slate-800">
                <span v-if="wf.minDays != null">&ge; {{ wf.minDays }}h</span>
                <span v-if="wf.maxDays != null"> s.d. &le; {{ wf.maxDays }}h</span>
              </span>
            </div>
          </div>

          <div class="pt-1 flex items-center justify-end">
            <NuxtLink
              :to="`/admin/alur/${wf.id}`"
              class="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Kelola Tahap & Uji Simulasi
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Tambah Alur Baru -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div class="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900">Buat Alur Persetujuan Baru</h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 p-1"
            @click="showAddModal = false"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div v-if="formError" class="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
          {{ formError }}
        </div>

        <div class="space-y-3 text-xs">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Kode Unik Alur <span class="text-rose-500">*</span></label>
              <input
                v-model="form.code"
                type="text"
                placeholder="misal: WF_CUTI_PANJANG"
                class="input text-xs font-mono uppercase"
              />
            </div>
            <div>
              <label class="label text-xs">Prioritas Evaluasi <span class="text-rose-500">*</span></label>
              <input
                v-model.number="form.priority"
                type="number"
                min="1"
                placeholder="Angka kecil dievaluasi lebih dulu"
                class="input text-xs"
              />
            </div>
          </div>

          <div>
            <label class="label text-xs">Nama Alur <span class="text-rose-500">*</span></label>
            <input
              v-model="form.name"
              type="text"
              placeholder="misal: Alur Cuti Tahunan Lebih dari 5 Hari"
              class="input text-xs font-medium"
            />
          </div>

          <div>
            <label class="label text-xs">Deskripsi</label>
            <textarea
              v-model="form.description"
              rows="2"
              placeholder="Penjelasan tujuan dan lingkup alur ini..."
              class="input text-xs"
            ></textarea>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Filter Jenis Izin</label>
              <select v-model="form.leaveTypeId" class="input text-xs">
                <option value="">Semua Jenis Izin</option>
                <option
                  v-for="lt in leaveTypes"
                  :key="lt.id"
                  :value="lt.id"
                >
                  {{ lt.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="label text-xs">Filter Departemen</label>
              <select v-model="form.departmentId" class="input text-xs">
                <option value="">Semua Departemen</option>
                <option
                  v-for="dept in departments"
                  :key="dept.id"
                  :value="dept.id"
                >
                  {{ dept.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Durasi Minimal (Hari)</label>
              <input
                v-model="form.minDays"
                type="number"
                step="0.5"
                placeholder="Bebas"
                class="input text-xs"
              />
            </div>
            <div>
              <label class="label text-xs">Durasi Maksimal (Hari)</label>
              <input
                v-model="form.maxDays"
                type="number"
                step="0.5"
                placeholder="Bebas"
                class="input text-xs"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input
              id="is_active_check"
              v-model="form.isActive"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label for="is_active_check" class="text-xs font-semibold text-slate-700">
              Aktifkan alur ini di sistem secara langsung
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            class="btn-ghost text-xs py-2 px-3.5"
            :disabled="isSubmitting"
            @click="showAddModal = false"
          >
            Batal
          </button>
          <button
            type="button"
            class="btn-primary text-xs py-2 px-4"
            :disabled="isSubmitting"
            @click="handleCreateWorkflow"
          >
            <span v-if="isSubmitting" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent mr-1"></span>
            Simpan & Atur Tahap
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
