<script setup lang="ts">
useHead({
  title: 'Pengaturan Hak Pengajuan Izin',
})

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

// Fetch jenis izin
const { data: typesData } = await useFetch<{ data: any[] }>('/api/admin/leave-types')
const currentType = computed(() => typesData.value?.data?.find((t) => t.id === id))

// Fetch master data untuk relasi
const { data: deptData } = await useFetch<{ data: any[] }>('/api/admin/departments')
const { data: posData } = await useFetch<{ data: any[] }>('/api/admin/positions')
const { data: empListData } = await useFetch<{ data: { items: any[] } }>('/api/admin/employees', {
  query: { perPage: 100, isActive: true },
})

const departments = computed(() => deptData.value?.data ?? [])
const positions = computed(() => posData.value?.data ?? [])
const employees = computed(() => empListData.value?.data?.items ?? [])

// Fetch aturan hak pengajuan saat ini
const { data: rulesData, refresh: refreshRules } = await useFetch<{ data: any[] }>(
  `/api/admin/leave-types/${id}/eligibility`
)
const existingRules = computed(() => rulesData.value?.data ?? [])

// Pisahkan antara aturan umum vs pengecualian per pegawai
const employeeOverrides = computed(() => existingRules.value.filter((r) => r.employeeId))
const generalRules = computed(() => existingRules.value.filter((r) => !r.employeeId))

// Modal Tambah Aturan
const modalOpen = ref(false)
const modalType = ref<'general' | 'employee'>('general')

const form = reactive({
  employeeId: '',
  departmentId: '',
  positionId: '',
  employmentStatus: '' as any,
  isAllowed: false,
  note: '',
})
const modalError = ref('')
const isSaving = ref(false)

function openAddGeneral() {
  modalType.value = 'general'
  form.employeeId = ''
  form.departmentId = ''
  form.positionId = ''
  form.employmentStatus = ''
  form.isAllowed = false
  form.note = ''
  modalError.value = ''
  modalOpen.value = true
}

function openAddEmployeeOverride() {
  modalType.value = 'employee'
  form.employeeId = ''
  form.departmentId = ''
  form.positionId = ''
  form.employmentStatus = ''
  form.isAllowed = true
  form.note = ''
  modalError.value = ''
  modalOpen.value = true
}

async function handleAddRule() {
  modalError.value = ''
  if (modalType.value === 'employee' && !form.employeeId) {
    modalError.value = 'Silakan pilih pegawai untuk pengecualian.'
    return
  }
  if (
    modalType.value === 'general' &&
    !form.departmentId &&
    !form.positionId &&
    !form.employmentStatus
  ) {
    modalError.value = 'Pilih minimal satu kriteria (departemen, jabatan, atau status).'
    return
  }

  isSaving.value = true
  try {
    const newRule = {
      employeeId: form.employeeId || null,
      departmentId: form.departmentId || null,
      positionId: form.positionId || null,
      employmentStatus: form.employmentStatus || null,
      isAllowed: form.isAllowed,
      note: form.note || null,
    }

    // Gabungkan dengan aturan lama dan simpan ke API
    const updatedRules = [
      ...existingRules.value.map((r) => ({
        employeeId: r.employeeId || null,
        departmentId: r.departmentId || null,
        positionId: r.positionId || null,
        employmentStatus: r.employmentStatus || null,
        isAllowed: Boolean(r.isAllowed),
        note: r.note || null,
      })),
      newRule,
    ]

    await $fetch(`/api/admin/leave-types/${id}/eligibility`, {
      method: 'PUT',
      body: { rules: updatedRules },
    })

    modalOpen.value = false
    await refreshRules()
  } catch (err: any) {
    modalError.value = err?.data?.message || err?.statusMessage || 'Gagal menyimpan aturan.'
  } finally {
    isSaving.value = false
  }
}

async function handleDeleteRule(indexToRemove: number, isEmployeeOverride: boolean) {
  if (!confirm('Hapus aturan ini?')) return

  const targetList = isEmployeeOverride ? employeeOverrides.value : generalRules.value
  const targetItem = targetList[indexToRemove]
  if (!targetItem) return

  const updatedRules = existingRules.value
    .filter((r) => r.id !== targetItem.id)
    .map((r) => ({
      employeeId: r.employeeId || null,
      departmentId: r.departmentId || null,
      positionId: r.positionId || null,
      employmentStatus: r.employmentStatus || null,
      isAllowed: Boolean(r.isAllowed),
      note: r.note || null,
    }))

  await $fetch(`/api/admin/leave-types/${id}/eligibility`, {
    method: 'PUT',
    body: { rules: updatedRules },
  })
  await refreshRules()
}
</script>

<template>
  <div class="space-y-4">
    <AppPageHeader
      :title="`Hak Pengajuan: ${currentType?.name || 'Jenis Izin'}`"
      subtitle="Atur kriteria siapa saja yang berhak atau dilarang mengajukan jenis perizinan ini"
    >
      <template #actions>
        <NuxtLink to="/admin/jenis-izin" class="btn-ghost text-xs px-3 py-2">
          Kembali
        </NuxtLink>
      </template>
    </AppPageHeader>

    <!-- Urutan Evaluasi Info -->
    <div class="rounded-lg bg-blue-50 p-3.5 text-xs text-blue-800 border border-blue-200 space-y-1">
      <p class="font-bold">Logika Urutan Evaluasi Sistem:</p>
      <ol class="list-decimal pl-4 space-y-0.5 text-[11px]">
        <li>Pegawai dengan status <code>can_submit_request = false</code> otomatis ditolak seluruh izin.</li>
        <li><strong>Pengecualian Pegawai:</strong> Aturan khusus per individu langsung berlaku (mengalahkan aturan umum).</li>
        <li><strong>Batasan Umum:</strong> Jika ada kriteria departemen / jabatan / status kepegawaian yang dilarang, pengajuan ditolak.</li>
        <li>Selain kondisi di atas, pegawai <strong>diizinkan</strong> mengajukan.</li>
      </ol>
    </div>

    <!-- Bagian 1: Pengecualian Khusus Pegawai -->
    <div class="card p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold text-slate-900 text-sm">Pengecualian Per Pegawai (Override)</h2>
          <p class="text-xs text-slate-500">Izin khusus atau larangan khusus untuk nama pegawai tertentu</p>
        </div>
        <button
          type="button"
          class="btn-primary text-xs px-2.5 py-1.5"
          @click="openAddEmployeeOverride"
        >
          + Pegawai
        </button>
      </div>

      <div v-if="employeeOverrides.length > 0" class="space-y-2">
        <div
          v-for="(rule, idx) in employeeOverrides"
          :key="rule.id || idx"
          class="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900">{{ rule.employeeName }}</span>
              <span class="text-slate-400 font-mono">({{ rule.employeeNip }})</span>
              <span
                class="badge text-[10px]"
                :class="rule.isAllowed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'"
              >
                {{ rule.isAllowed ? 'Diizinkan Eksplisit' : 'Dilarang Eksplisit' }}
              </span>
            </div>
            <p v-if="rule.note" class="text-slate-500 text-[11px] mt-0.5">Catatan: {{ rule.note }}</p>
          </div>

          <button
            type="button"
            class="text-red-600 hover:text-red-800 text-xs px-2 py-1"
            @click="handleDeleteRule(idx, true)"
          >
            Hapus
          </button>
        </div>
      </div>
      <p v-else class="text-xs text-slate-400 italic py-2">Belum ada pengecualian per pegawai.</p>
    </div>

    <!-- Bagian 2: Batasan Kriteria Umum -->
    <div class="card p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold text-slate-900 text-sm">Batasan Kriteria Umum</h2>
          <p class="text-xs text-slate-500">Kriteria departemen, jabatan, atau status kerja yang dibatasi</p>
        </div>
        <button
          type="button"
          class="btn-primary text-xs px-2.5 py-1.5"
          @click="openAddGeneral"
        >
          + Batasan
        </button>
      </div>

      <div v-if="generalRules.length > 0" class="space-y-2">
        <div
          v-for="(rule, idx) in generalRules"
          :key="rule.id || idx"
          class="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
        >
          <div>
            <div class="flex items-center gap-2">
              <span
                class="badge text-[10px]"
                :class="rule.isAllowed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'"
              >
                {{ rule.isAllowed ? 'Izinkan' : 'Larang' }}
              </span>
              <span class="font-medium text-slate-800">
                <span v-if="rule.departmentName">Dept: {{ rule.departmentName }} </span>
                <span v-if="rule.positionName">Jabatan: {{ rule.positionName }} </span>
                <span v-if="rule.employmentStatus">Status: {{ rule.employmentStatus }} </span>
              </span>
            </div>
            <p v-if="rule.note" class="text-slate-500 text-[11px] mt-0.5">Catatan: {{ rule.note }}</p>
          </div>

          <button
            type="button"
            class="text-red-600 hover:text-red-800 text-xs px-2 py-1"
            @click="handleDeleteRule(idx, false)"
          >
            Hapus
          </button>
        </div>
      </div>
      <p v-else class="text-xs text-slate-400 italic py-2">Tidak ada batasan umum (semua pegawai berhak mengajukan secara default).</p>
    </div>

    <!-- Modal Form Tambah Rule -->
    <Teleport to="body">
      <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" @click="modalOpen = false" />
        <div class="card relative z-10 w-full max-w-sm p-5 shadow-xl space-y-4">
          <h3 class="font-bold text-slate-900 text-base">
            {{ modalType === 'employee' ? 'Tambah Pengecualian Pegawai' : 'Tambah Batasan Kriteria Umum' }}
          </h3>

          <div v-if="modalError" class="rounded bg-red-50 p-2 text-xs text-red-600 font-medium">
            {{ modalError }}
          </div>

          <form class="space-y-3" @submit.prevent="handleAddRule">
            <!-- Pilihan Pegawai -->
            <div v-if="modalType === 'employee'">
              <AppFormField label="Pilih Pegawai" required>
                <select v-model="form.employeeId" class="input text-xs" required>
                  <option value="">Pilih Pegawai...</option>
                  <option v-for="e in employees" :key="e.id" :value="e.id">
                    {{ e.fullName }} ({{ e.nip }})
                  </option>
                </select>
              </AppFormField>
            </div>

            <!-- Kriteria Umum -->
            <div v-else class="space-y-3">
              <AppFormField label="Berdasarkan Departemen (Opsional)">
                <select v-model="form.departmentId" class="input text-xs">
                  <option value="">Semua Departemen</option>
                  <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </AppFormField>

              <AppFormField label="Berdasarkan Jabatan (Opsional)">
                <select v-model="form.positionId" class="input text-xs">
                  <option value="">Semua Jabatan</option>
                  <option v-for="p in positions" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </AppFormField>

              <AppFormField label="Berdasarkan Status Kerja (Opsional)">
                <select v-model="form.employmentStatus" class="input text-xs">
                  <option value="">Semua Status</option>
                  <option value="PERMANENT">Karyawan Tetap</option>
                  <option value="CONTRACT">Kontrak</option>
                  <option value="PROBATION">Masa Percobaan (Probation)</option>
                  <option value="INTERN">Magang</option>
                  <option value="OUTSOURCE">Outsource</option>
                </select>
              </AppFormField>
            </div>

            <AppFormField label="Keputusan Akses" required>
              <select v-model="form.isAllowed" class="input text-xs" required>
                <option :value="false">DILARANG Mengajukan</option>
                <option :value="true">DIIZINKAN Mengajukan</option>
              </select>
            </AppFormField>

            <AppFormField label="Catatan / Alasan">
              <input v-model="form.note" type="text" placeholder="Contoh: Belum genap masa percobaan" class="input text-xs" />
            </AppFormField>

            <div class="flex gap-2 justify-end pt-2">
              <button type="button" class="btn-ghost text-xs" @click="modalOpen = false">Batal</button>
              <button type="submit" :disabled="isSaving" class="btn-primary text-xs">
                {{ isSaving ? 'Menyimpan...' : 'Simpan Aturan' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
