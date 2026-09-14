<script setup lang="ts">
useHead({
  title: 'Struktur Organisasi',
})

const activeTab = ref<'departments' | 'positions'>('departments')

// Fetch data
const { data: deptData, refresh: refreshDept } = await useFetch<{ data: any[] }>('/api/admin/departments')
const { data: posData, refresh: refreshPos } = await useFetch<{ data: any[] }>('/api/admin/positions')
const { data: empListData } = await useFetch<{ data: { items: any[] } }>('/api/admin/employees', {
  query: { perPage: 100, isActive: true },
})

const departments = computed(() => deptData.value?.data ?? [])
const positions = computed(() => posData.value?.data ?? [])
const employees = computed(() => empListData.value?.data?.items ?? [])

// Modal Departemen
const deptModalOpen = ref(false)
const editingDept = ref<any>(null)
const deptForm = reactive({
  code: '',
  name: '',
  parentId: '',
  headEmployeeId: '',
  isActive: true,
})
const deptError = ref('')
const deptSaving = ref(false)

function openAddDept() {
  editingDept.value = null
  deptForm.code = ''
  deptForm.name = ''
  deptForm.parentId = ''
  deptForm.headEmployeeId = ''
  deptForm.isActive = true
  deptError.value = ''
  deptModalOpen.value = true
}

function openEditDept(d: any) {
  editingDept.value = d
  deptForm.code = d.code
  deptForm.name = d.name
  deptForm.parentId = d.parentId || ''
  deptForm.headEmployeeId = d.headEmployeeId || ''
  deptForm.isActive = Boolean(d.isActive)
  deptError.value = ''
  deptModalOpen.value = true
}

async function handleSaveDept() {
  deptError.value = ''
  deptSaving.value = true
  try {
    const payload = {
      code: deptForm.code,
      name: deptForm.name,
      parentId: deptForm.parentId || null,
      headEmployeeId: deptForm.headEmployeeId || null,
      isActive: deptForm.isActive,
    }

    if (editingDept.value) {
      await $fetch(`/api/admin/departments/${editingDept.value.id}`, {
        method: 'PATCH',
        body: payload,
      })
    } else {
      await $fetch('/api/admin/departments', {
        method: 'POST',
        body: payload,
      })
    }
    deptModalOpen.value = false
    await refreshDept()
  } catch (err: any) {
    deptError.value = err?.data?.message || err?.statusMessage || 'Gagal menyimpan departemen.'
  } finally {
    deptSaving.value = false
  }
}

// Modal Jabatan
const posModalOpen = ref(false)
const editingPos = ref<any>(null)
const posForm = reactive({
  code: '',
  name: '',
  level: 1,
  isActive: true,
})
const posError = ref('')
const posSaving = ref(false)

function openAddPos() {
  editingPos.value = null
  posForm.code = ''
  posForm.name = ''
  posForm.level = 1
  posForm.isActive = true
  posError.value = ''
  posModalOpen.value = true
}

function openEditPos(p: any) {
  editingPos.value = p
  posForm.code = p.code
  posForm.name = p.name
  posForm.level = p.level
  posForm.isActive = Boolean(p.isActive)
  posError.value = ''
  posModalOpen.value = true
}

async function handleSavePos() {
  posError.value = ''
  posSaving.value = true
  try {
    const payload = {
      code: posForm.code,
      name: posForm.name,
      level: Number(posForm.level),
      isActive: posForm.isActive,
    }

    if (editingPos.value) {
      await $fetch(`/api/admin/positions/${editingPos.value.id}`, {
        method: 'PATCH',
        body: payload,
      })
    } else {
      await $fetch('/api/admin/positions', {
        method: 'POST',
        body: payload,
      })
    }
    posModalOpen.value = false
    await refreshPos()
  } catch (err: any) {
    posError.value = err?.data?.message || err?.statusMessage || 'Gagal menyimpan jabatan.'
  } finally {
    posSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <AppPageHeader
      title="Struktur Organisasi"
      subtitle="Kelola data unit kerja (departemen) dan tingkatan jabatan pegawai"
    >
      <template #actions>
        <button
          v-if="activeTab === 'departments'"
          type="button"
          class="btn-primary text-xs px-3 py-2"
          @click="openAddDept"
        >
          + Departemen
        </button>
        <button
          v-else
          type="button"
          class="btn-primary text-xs px-3 py-2"
          @click="openAddPos"
        >
          + Jabatan
        </button>
      </template>
    </AppPageHeader>

    <!-- Tab Pilihan -->
    <div class="flex border-b border-slate-200">
      <button
        type="button"
        class="border-b-2 px-4 py-2.5 text-sm font-medium transition"
        :class="activeTab === 'departments' ? 'border-brand-600 text-brand-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'departments'"
      >
        Departemen ({{ departments.length }})
      </button>
      <button
        type="button"
        class="border-b-2 px-4 py-2.5 text-sm font-medium transition"
        :class="activeTab === 'positions' ? 'border-brand-600 text-brand-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'positions'"
      >
        Jabatan ({{ positions.length }})
      </button>
    </div>

    <!-- Tab Departemen -->
    <div v-show="activeTab === 'departments'" class="space-y-3">
      <div v-if="departments.length > 0" class="space-y-2">
        <div
          v-for="dept in departments"
          :key="dept.id"
          class="card p-3.5 flex items-center justify-between hover:border-slate-300 transition"
        >
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-slate-900 text-sm">{{ dept.name }}</h3>
              <span class="badge bg-slate-100 text-slate-600 text-[10px] font-mono">{{ dept.code }}</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Kepala Dept: <strong>{{ dept.headEmployeeName || 'Belum diatur' }}</strong>
            </p>
          </div>

          <div class="flex items-center gap-2">
            <span class="badge" :class="dept.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'">
              {{ dept.isActive ? 'Aktif' : 'Nonaktif' }}
            </span>
            <button
              type="button"
              class="btn-ghost text-xs px-2.5 py-1"
              @click="openEditDept(dept)"
            >
              Ubah
            </button>
          </div>
        </div>
      </div>
      <AppEmptyState v-else title="Belum ada departemen" />
    </div>

    <!-- Tab Jabatan -->
    <div v-show="activeTab === 'positions'" class="space-y-3">
      <div v-if="positions.length > 0" class="space-y-2">
        <div
          v-for="pos in positions"
          :key="pos.id"
          class="card p-3.5 flex items-center justify-between hover:border-slate-300 transition"
        >
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-slate-900 text-sm">{{ pos.name }}</h3>
              <span class="badge bg-blue-50 text-blue-700 font-bold text-[10px]">Level {{ pos.level }}</span>
            </div>
            <p class="text-xs text-slate-500 mt-1 font-mono">Kode: {{ pos.code }}</p>
          </div>

          <div class="flex items-center gap-2">
            <span class="badge" :class="pos.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'">
              {{ pos.isActive ? 'Aktif' : 'Nonaktif' }}
            </span>
            <button
              type="button"
              class="btn-ghost text-xs px-2.5 py-1"
              @click="openEditPos(pos)"
            >
              Ubah
            </button>
          </div>
        </div>
      </div>
      <AppEmptyState v-else title="Belum ada jabatan" />
    </div>

    <!-- Modal Departemen -->
    <Teleport to="body">
      <div v-if="deptModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" @click="deptModalOpen = false" />
        <div class="card relative z-10 w-full max-w-sm p-5 shadow-xl space-y-4">
          <h3 class="font-bold text-slate-900 text-base">
            {{ editingDept ? 'Ubah Departemen' : 'Tambah Departemen' }}
          </h3>

          <div v-if="deptError" class="rounded bg-red-50 p-2 text-xs text-red-600 font-medium">
            {{ deptError }}
          </div>

          <form class="space-y-3" @submit.prevent="handleSaveDept">
            <AppFormField label="Kode Departemen" required>
              <input v-model="deptForm.code" type="text" required placeholder="Contoh: IT, HR, FIN" class="input uppercase text-xs" />
            </AppFormField>

            <AppFormField label="Nama Departemen" required>
              <input v-model="deptForm.name" type="text" required placeholder="Contoh: Teknologi Informasi" class="input text-xs" />
            </AppFormField>

            <AppFormField label="Kepala Departemen (Manager)">
              <select v-model="deptForm.headEmployeeId" class="input text-xs">
                <option value="">Belum ditentukan</option>
                <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.fullName }} ({{ e.nip }})</option>
              </select>
            </AppFormField>

            <AppToggle v-model="deptForm.isActive" label="Departemen Aktif" />

            <div class="flex gap-2 justify-end pt-2">
              <button type="button" class="btn-ghost text-xs" @click="deptModalOpen = false">Batal</button>
              <button type="submit" :disabled="deptSaving" class="btn-primary text-xs">
                {{ deptSaving ? 'Menyimpan...' : 'Simpan' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal Jabatan -->
    <Teleport to="body">
      <div v-if="posModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" @click="posModalOpen = false" />
        <div class="card relative z-10 w-full max-w-sm p-5 shadow-xl space-y-4">
          <h3 class="font-bold text-slate-900 text-base">
            {{ editingPos ? 'Ubah Jabatan' : 'Tambah Jabatan' }}
          </h3>

          <div v-if="posError" class="rounded bg-red-50 p-2 text-xs text-red-600 font-medium">
            {{ posError }}
          </div>

          <form class="space-y-3" @submit.prevent="handleSavePos">
            <AppFormField label="Kode Jabatan" required>
              <input v-model="posForm.code" type="text" required placeholder="Contoh: STAFF, MGR, DIR" class="input uppercase text-xs" />
            </AppFormField>

            <AppFormField label="Nama Jabatan" required>
              <input v-model="posForm.name" type="text" required placeholder="Contoh: Senior Software Engineer" class="input text-xs" />
            </AppFormField>

            <AppFormField label="Level Jabatan (1 - 10)" required hint="1 = Staf, 10 = Direktur Utama">
              <input v-model="posForm.level" type="number" min="1" max="10" required class="input text-xs" />
            </AppFormField>

            <AppToggle v-model="posForm.isActive" label="Jabatan Aktif" />

            <div class="flex gap-2 justify-end pt-2">
              <button type="button" class="btn-ghost text-xs" @click="posModalOpen = false">Batal</button>
              <button type="submit" :disabled="posSaving" class="btn-primary text-xs">
                {{ posSaving ? 'Menyimpan...' : 'Simpan' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
