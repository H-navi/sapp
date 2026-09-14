<script setup lang="ts">
import dayjs from 'dayjs'

useHead({
  title: 'Delegasi Wewenang · Sistem Perizinan Pegawai',
})

const { data: res, pending, refresh } = await useFetch<{ data: any[] }>('/api/approvals/delegations')
const delegations = computed(() => res.value?.data ?? [])

// Ambil kandidat pegawai dan jenis izin untuk modal
const { data: candidatesRes } = await useFetch<{ data: { employees: any[]; leaveTypes: any[] } }>(
  '/api/approvals/delegations/candidates'
)
const candidateEmployees = computed(() => candidatesRes.value?.data?.employees ?? [])
const candidateLeaveTypes = computed(() => candidatesRes.value?.data?.leaveTypes ?? [])

// Modal Tambah Delegasi
const showAddModal = ref(false)
const isSubmitting = ref(false)
const formError = ref<string | null>(null)

const form = reactive({
  delegateEmployeeId: '',
  leaveTypeId: '',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
  reason: '',
})

function openAddModal() {
  form.delegateEmployeeId = ''
  form.leaveTypeId = ''
  form.startDate = dayjs().format('YYYY-MM-DD')
  form.endDate = dayjs().add(3, 'day').format('YYYY-MM-DD')
  form.reason = ''
  formError.value = null
  showAddModal.value = true
}

async function handleCreateDelegation() {
  if (!form.delegateEmployeeId) {
    formError.value = 'Pilih pegawai yang akan menerima delegasi wewenang.'
    return
  }
  if (!form.startDate || !form.endDate) {
    formError.value = 'Tentukan rentang tanggal delegasi dengan lengkap.'
    return
  }
  if (dayjs(form.endDate).isBefore(dayjs(form.startDate))) {
    formError.value = 'Tanggal selesai tidak boleh mendahului tanggal mulai.'
    return
  }

  isSubmitting.value = true
  formError.value = null

  try {
    await $fetch('/api/approvals/delegations', {
      method: 'POST',
      body: {
        delegateEmployeeId: form.delegateEmployeeId,
        leaveTypeId: form.leaveTypeId || null,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || undefined,
      },
    })
    showAddModal.value = false
    await refresh()
  } catch (err: any) {
    formError.value = err?.data?.message || err?.message || 'Gagal membuat delegasi wewenang.'
  } finally {
    isSubmitting.value = false
  }
}

// Hapus / Cabut Delegasi
const deletingId = ref<string | null>(null)

async function handleDeleteDelegation(id: string) {
  if (!confirm('Apakah Anda yakin ingin mencabut delegasi wewenang ini?')) {
    return
  }

  deletingId.value = id
  try {
    await $fetch(`/api/approvals/delegations/${id}`, {
      method: 'DELETE',
    })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.message || 'Gagal mencabut delegasi.')
  } finally {
    deletingId.value = null
  }
}

function getDelegationStatus(d: any) {
  const today = dayjs().format('YYYY-MM-DD')
  if (!d.isActive) {
    return { label: 'Nonaktif', class: 'bg-slate-100 text-slate-600' }
  }
  if (today < d.startDate) {
    return { label: 'Terjadwal', class: 'bg-blue-50 text-blue-700 border-blue-200' }
  }
  if (today > d.endDate) {
    return { label: 'Kedaluwarsa', class: 'bg-slate-100 text-slate-500' }
  }
  return { label: 'Sedang Aktif', class: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' }
}
</script>

<template>
  <div class="space-y-5 pb-12">
    <!-- Header Halaman -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <NuxtLink to="/approval" class="hover:text-brand-600 transition-colors flex items-center gap-1">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Kotak Masuk
          </NuxtLink>
          <span>/</span>
          <span class="text-slate-700">Delegasi</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
          Delegasi Wewenang Persetujuan
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 sm:text-sm">
          Limpahkan hak persetujuan izin kepada rekan sejawat selama Anda cuti atau dinas luar.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 shadow-sm"
          @click="openAddModal"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Beri Delegasi Baru
        </button>
      </div>
    </div>

    <!-- State Memuat -->
    <div v-if="pending && delegations.length === 0" class="card p-10 text-center text-slate-400 text-sm">
      <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent mb-2"></div>
      <p>Memuat daftar delegasi...</p>
    </div>

    <!-- State Kosong -->
    <div v-else-if="delegations.length === 0" class="card p-10 text-center space-y-3">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </div>
      <div>
        <h3 class="text-base font-bold text-slate-900">Belum Ada Delegasi</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Anda belum mendelegasikan hak persetujuan ke siapapun. Seluruh tugas persetujuan akan langsung diarahkan kepada Anda.
        </p>
      </div>
      <div class="pt-2">
        <button
          type="button"
          class="btn-primary text-xs py-2 px-4"
          @click="openAddModal"
        >
          Mulai Buat Delegasi
        </button>
      </div>
    </div>

    <!-- Daftar Delegasi -->
    <div v-else class="space-y-3">
      <div
        v-for="item in delegations"
        :key="item.id"
        class="card p-4 sm:p-5 space-y-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="badge border text-[11px]"
                :class="getDelegationStatus(item).class"
              >
                {{ getDelegationStatus(item).label }}
              </span>

              <span class="badge bg-slate-100 text-slate-700 text-[11px]">
                {{ item.leaveTypeName }}
              </span>
            </div>

            <h3 class="text-base font-bold text-slate-900 pt-1">
              Didelegasikan kepada: {{ item.delegateName }}
            </h3>
            <p class="text-xs text-slate-500">
              NIP: {{ item.delegateNip || '-' }}
            </p>
          </div>

          <button
            type="button"
            class="text-xs font-semibold text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition"
            :disabled="deletingId === item.id"
            title="Cabut delegasi ini"
            @click="handleDeleteDelegation(item.id)"
          >
            <span v-if="deletingId === item.id" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-600 border-r-transparent"></span>
            <span v-else class="flex items-center gap-1">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Cabut
            </span>
          </button>
        </div>

        <!-- Rentang Waktu & Alasan -->
        <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-600">
          <div>
            <span class="text-slate-400">Periode Waktu:</span>
            <strong> {{ dayjs(item.startDate).format('D MMM YYYY') }}</strong> s.d. <strong>{{ dayjs(item.endDate).format('D MMM YYYY') }}</strong>
          </div>

          <p v-if="item.reason" class="italic text-slate-500">
            "{{ item.reason }}"
          </p>
        </div>
      </div>
    </div>

    <!-- Modal Tambah Delegasi -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div class="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900">Beri Delegasi Wewenang Baru</h3>
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
          <div>
            <label class="label text-xs">Penerima Delegasi <span class="text-rose-500">*</span></label>
            <select v-model="form.delegateEmployeeId" class="input text-xs">
              <option value="" disabled>-- Pilih Rekan Pegawai --</option>
              <option
                v-for="emp in candidateEmployees"
                :key="emp.id"
                :value="emp.id"
              >
                {{ emp.fullName }} ({{ emp.positionName || 'Pegawai' }} · {{ emp.departmentName || 'Divisi' }})
              </option>
            </select>
          </div>

          <div>
            <label class="label text-xs">Cakupan Jenis Izin</label>
            <select v-model="form.leaveTypeId" class="input text-xs">
              <option value="">Semua Jenis Izin</option>
              <option
                v-for="lt in candidateLeaveTypes"
                :key="lt.id"
                :value="lt.id"
              >
                {{ lt.name }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs">Mulai Berlaku <span class="text-rose-500">*</span></label>
              <input v-model="form.startDate" type="date" class="input text-xs" />
            </div>
            <div>
              <label class="label text-xs">Selesai Berlaku <span class="text-rose-500">*</span></label>
              <input v-model="form.endDate" type="date" class="input text-xs" />
            </div>
          </div>

          <div>
            <label class="label text-xs">Alasan Delegasi</label>
            <textarea
              v-model="form.reason"
              rows="2"
              class="input text-xs"
              placeholder="Contoh: Mengambil cuti tahunan dan perjalanan ke luar negeri tanpa akses internet."
            ></textarea>
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
            @click="handleCreateDelegation"
          >
            <span v-if="isSubmitting" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent mr-1"></span>
            Simpan Delegasi
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
