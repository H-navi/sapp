<script setup lang="ts">
useHead({
  title: 'Detail Pegawai',
})

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const activeTab = ref<'profile' | 'account' | 'quota'>('profile')

// Fetch data pegawai
const { data: empRes, refresh: refreshEmp } = await useFetch(`/api/admin/employees/${id}`)
const employee = computed(() => empRes.value?.data as any)

// Fetch master data untuk pilihan
const { data: deptData } = await useFetch<{ data: Array<{ id: string; name: string }> }>('/api/admin/departments')
const { data: posData } = await useFetch<{ data: Array<{ id: string; name: string; level: number }> }>('/api/admin/positions')
const { data: empListData } = await useFetch<{ data: { items: Array<{ id: string; fullName: string; nip: string }> } }>('/api/admin/employees', {
  query: { perPage: 100, isActive: true },
})

const departments = computed(() => deptData.value?.data ?? [])
const positions = computed(() => posData.value?.data ?? [])
const managers = computed(() => (empListData.value?.data?.items ?? []).filter((m) => m.id !== id))

// Form Data Diri & Jabatan
const form = reactive({
  nip: '',
  fullName: '',
  email: '',
  phone: '',
  gender: 'MALE',
  birthDate: '',
  departmentId: '',
  positionId: '',
  managerId: '',
  employmentStatus: 'PERMANENT',
  joinDate: '',
  endDate: '',
  canSubmitRequest: true,
  telegramChatId: '',
  isActive: true,
})

// Isi form saat data tiba
watch(
  employee,
  (e) => {
    if (!e) return
    form.nip = e.nip || ''
    form.fullName = e.fullName || ''
    form.email = e.email || ''
    form.phone = e.phone || ''
    form.gender = e.gender || 'MALE'
    form.birthDate = e.birthDate || ''
    form.departmentId = e.departmentId || ''
    form.positionId = e.positionId || ''
    form.managerId = e.managerId || ''
    form.employmentStatus = e.employmentStatus || 'PERMANENT'
    form.joinDate = e.joinDate || ''
    form.endDate = e.endDate || ''
    form.canSubmitRequest = Boolean(e.canSubmitRequest)
    form.telegramChatId = e.telegramChatId || ''
    form.isActive = Boolean(e.isActive)
  },
  { immediate: true }
)

const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')

async function handleUpdateProfile() {
  saveError.value = ''
  saveSuccess.value = ''
  isSaving.value = true

  try {
    const payload = {
      ...form,
      departmentId: form.departmentId || null,
      positionId: form.positionId || null,
      managerId: form.managerId || null,
      birthDate: form.birthDate || null,
      endDate: form.endDate || null,
      phone: form.phone || null,
      telegramChatId: form.telegramChatId || null,
    }

    await $fetch(`/api/admin/employees/${id}`, {
      method: 'PATCH',
      body: payload,
    })

    saveSuccess.value = 'Perubahan data pegawai berhasil disimpan.'
    await refreshEmp()
  } catch (err: any) {
    saveError.value = err?.data?.message || err?.statusMessage || 'Gagal menyimpan data pegawai.'
  } finally {
    isSaving.value = false
  }
}

// Kelola Role
const availableRoles = ['EMPLOYEE', 'APPROVER', 'HR_APPROVER', 'ADMIN']
const selectedRoles = ref<string[]>([])

watch(
  () => employee.value?.user?.roles,
  (roles) => {
    if (roles) selectedRoles.value = [...roles]
  },
  { immediate: true }
)

const isSavingRoles = ref(false)
const roleError = ref('')
const roleSuccess = ref('')

async function handleSaveRoles() {
  if (!employee.value?.user?.id) return
  roleError.value = ''
  roleSuccess.value = ''
  isSavingRoles.value = true

  try {
    await $fetch(`/api/admin/users/${employee.value.user.id}/roles`, {
      method: 'PUT',
      body: { roles: selectedRoles.value },
    })
    roleSuccess.value = 'Hak akses / role berhasil diperbarui.'
    await refreshEmp()
  } catch (err: any) {
    roleError.value = err?.data?.message || err?.statusMessage || 'Gagal memperbarui role.'
  } finally {
    isSavingRoles.value = false
  }
}

// Reset Password
const isResetting = ref(false)
const resetModal = ref<{ username: string; temporaryPassword: string } | null>(null)

async function handleResetPassword() {
  isResetting.value = true
  try {
    const res = await $fetch<{ data: { username: string; temporaryPassword: string } }>(
      `/api/admin/employees/${id}/reset-password`,
      { method: 'POST' }
    )
    resetModal.value = res.data
  } catch (err: any) {
    alert(err?.data?.message || 'Gagal mereset kata sandi.')
  } finally {
    isResetting.value = false
  }
}

// Nonaktifkan Pegawai
const isDeactivating = ref(false)
const showDeactivateDialog = ref(false)
const deactivateEndDate = ref(new Date().toISOString().split('T')[0])
const deactivateWarning = ref<any[] | null>(null)

async function handleDeactivateConfirm() {
  isDeactivating.value = true
  try {
    const res = await $fetch<{ data: { success: boolean; pendingTasksWarning: any[] | null } }>(
      `/api/admin/employees/${id}/deactivate`,
      {
        method: 'POST',
        body: { endDate: deactivateEndDate.value },
      }
    )
    if (res.data.pendingTasksWarning) {
      deactivateWarning.value = res.data.pendingTasksWarning
    }
    showDeactivateDialog.value = false
    await refreshEmp()
  } catch (err: any) {
    alert(err?.data?.message || 'Gagal menonaktifkan pegawai.')
  } finally {
    isDeactivating.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <AppPageHeader
      :title="employee?.fullName || 'Detail Pegawai'"
      :subtitle="`${employee?.nip || ''} · ${employee?.departmentName || 'Tanpa Departemen'}`"
    >
      <template #actions>
        <NuxtLink to="/admin/pegawai" class="btn-ghost text-xs px-3 py-2">
          Kembali
        </NuxtLink>
      </template>
    </AppPageHeader>

    <!-- Navigasi Tab -->
    <div class="flex border-b border-slate-200">
      <button
        type="button"
        class="border-b-2 px-4 py-2.5 text-sm font-medium transition"
        :class="activeTab === 'profile' ? 'border-brand-600 text-brand-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'profile'"
      >
        Data Diri & Jabatan
      </button>
      <button
        type="button"
        class="border-b-2 px-4 py-2.5 text-sm font-medium transition"
        :class="activeTab === 'account' ? 'border-brand-600 text-brand-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'account'"
      >
        Akun & Hak Akses
      </button>
      <button
        type="button"
        class="border-b-2 px-4 py-2.5 text-sm font-medium transition"
        :class="activeTab === 'quota' ? 'border-brand-600 text-brand-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'quota'"
      >
        Kuota Cuti
      </button>
    </div>

    <!-- Peringatan Jika Ada Task Pending Saat Dinonaktifkan -->
    <div v-if="deactivateWarning" class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 space-y-2">
      <div class="font-bold flex items-center gap-1.5">
        <span>⚠️ Perhatian: Pegawai ini masih memiliki {{ deactivateWarning.length }} tugas approval aktif:</span>
      </div>
      <ul class="list-disc pl-5 space-y-1">
        <li v-for="t in deactivateWarning" :key="t.taskId">
          {{ t.stepName }} untuk pengajuan <strong>{{ t.requestNumber }}</strong> (Pemohon: {{ t.requesterName }})
        </li>
      </ul>
      <p class="text-[11px] text-amber-700">Mohon delegasikan tugas tersebut atau lakukan persetujuan administratif lewat alur approval.</p>
    </div>

    <!-- Tab 1: Data Diri & Jabatan -->
    <div v-show="activeTab === 'profile'" class="space-y-4">
      <div v-if="saveError" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ saveError }}
      </div>
      <div v-if="saveSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        {{ saveSuccess }}
      </div>

      <div class="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 border border-amber-200">
        <strong>Catatan Sistem:</strong> Mengubah departemen, jabatan, atau atasan tidak akan mengubah pengajuan izin yang sedang berjalan (alur approval telah disnapshot saat pengajuan dibuat).
      </div>

      <form class="card space-y-4 p-4" @submit.prevent="handleUpdateProfile">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AppFormField label="NIP" required>
            <input v-model="form.nip" type="text" required class="input" />
          </AppFormField>

          <AppFormField label="Nama Lengkap" required>
            <input v-model="form.fullName" type="text" required class="input" />
          </AppFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AppFormField label="Email Perusahaan" required>
            <input v-model="form.email" type="email" required class="input" />
          </AppFormField>

          <AppFormField label="Telepon">
            <input v-model="form.phone" type="tel" class="input" />
          </AppFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <AppFormField label="Jenis Kelamin">
            <select v-model="form.gender" class="input">
              <option value="MALE">Laki-laki</option>
              <option value="FEMALE">Perempuan</option>
            </select>
          </AppFormField>

          <AppFormField label="Tanggal Lahir">
            <input v-model="form.birthDate" type="date" class="input" />
          </AppFormField>
        </div>

        <div class="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AppFormField label="Departemen">
            <select v-model="form.departmentId" class="input">
              <option value="">Tanpa Departemen</option>
              <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </AppFormField>

          <AppFormField label="Jabatan">
            <select v-model="form.positionId" class="input">
              <option value="">Tanpa Jabatan</option>
              <option v-for="p in positions" :key="p.id" :value="p.id">{{ p.name }} (Lvl {{ p.level }})</option>
            </select>
          </AppFormField>

          <AppFormField label="Atasan Langsung (Manager)">
            <select v-model="form.managerId" class="input">
              <option value="">Tanpa Atasan (Tertinggi)</option>
              <option v-for="m in managers" :key="m.id" :value="m.id">{{ m.fullName }}</option>
            </select>
          </AppFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AppFormField label="Status Kepegawaian">
            <select v-model="form.employmentStatus" class="input">
              <option value="PERMANENT">Karyawan Tetap</option>
              <option value="CONTRACT">Kontrak</option>
              <option value="PROBATION">Probation</option>
              <option value="INTERN">Magang</option>
              <option value="OUTSOURCE">Outsource</option>
            </select>
          </AppFormField>

          <AppFormField label="Tanggal Bergabung">
            <input v-model="form.joinDate" type="date" class="input" />
          </AppFormField>
        </div>

        <div class="border-t border-slate-100 pt-3 space-y-3">
          <AppToggle
            v-model="form.canSubmitRequest"
            label="Hak Mengajukan Perizinan (Umum)"
          />

          <AppToggle
            v-model="form.isActive"
            label="Pegawai Berstatus Aktif"
          />
        </div>

        <div class="pt-2">
          <button type="submit" :disabled="isSaving" class="btn-primary w-full sm:w-auto">
            <span v-if="isSaving">Menyimpan...</span>
            <span v-else>Simpan Perubahan</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Tab 2: Akun & Hak Akses -->
    <div v-show="activeTab === 'account'" class="space-y-4">
      <div v-if="roleError" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ roleError }}
      </div>
      <div v-if="roleSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        {{ roleSuccess }}
      </div>

      <!-- Ringkasan Akun -->
      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-slate-900 text-sm">Status Akun Login</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span class="text-slate-400">Username:</span>
            <p class="font-mono font-medium text-slate-800 mt-0.5">{{ employee?.user?.username || '-' }}</p>
          </div>
          <div>
            <span class="text-slate-400">Status Keamanan:</span>
            <p class="font-medium mt-0.5" :class="employee?.user?.mustChangePassword ? 'text-status-pending' : 'text-status-approved'">
              {{ employee?.user?.mustChangePassword ? 'Wajib ganti password' : 'Aktif normal' }}
            </p>
          </div>
          <div>
            <span class="text-slate-400">Gagal Login:</span>
            <p class="font-medium text-slate-800 mt-0.5">{{ employee?.user?.failedLoginCount ?? 0 }} kali</p>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-3 flex flex-wrap gap-2">
          <button
            type="button"
            :disabled="isResetting"
            class="btn-ghost text-xs"
            @click="handleResetPassword"
          >
            {{ isResetting ? 'Mereset...' : 'Reset Password' }}
          </button>

          <button
            v-if="employee?.isActive"
            type="button"
            class="btn border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs"
            @click="showDeactivateDialog = true"
          >
            Nonaktifkan Pegawai
          </button>
        </div>
      </div>

      <!-- Pilihan Role -->
      <div class="card p-4 space-y-4">
        <div>
          <h3 class="font-semibold text-slate-900 text-sm">Role & Wewenang</h3>
          <p class="text-xs text-slate-500 mt-0.5">Tentukan peran pengguna ini di dalam sistem SAPP.</p>
        </div>

        <div class="space-y-2">
          <label
            v-for="role in availableRoles"
            :key="role"
            class="flex items-center gap-3 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs"
          >
            <input
              v-model="selectedRoles"
              type="checkbox"
              :value="role"
              class="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
            />
            <div>
              <span class="font-semibold text-slate-800">{{ role }}</span>
              <p class="text-[11px] text-slate-500">
                {{ role === 'ADMIN' ? 'Akses penuh pengaturan sistem, pegawai, dan data master' : role === 'APPROVER' ? 'Menyetujui perizinan sesuai jenjang workflow' : role === 'HR_APPROVER' ? 'Approval khusus departemen HR & verifikasi berkas' : 'Login dan mengajukan perizinan sendiri' }}
              </p>
            </div>
          </label>
        </div>

        <button
          type="button"
          :disabled="isSavingRoles"
          class="btn-primary text-xs"
          @click="handleSaveRoles"
        >
          {{ isSavingRoles ? 'Menyimpan...' : 'Simpan Hak Akses' }}
        </button>
      </div>
    </div>

    <!-- Tab 3: Kuota Cuti -->
    <div v-show="activeTab === 'quota'" class="space-y-4">
      <div class="card p-4">
        <h3 class="font-semibold text-slate-900 text-sm mb-3">Saldo & Kuota Tahun Berjalan</h3>
        <div v-if="employee?.quotas?.length > 0" class="space-y-3">
          <div
            v-for="q in employee.quotas"
            :key="q.id"
            class="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-2 text-xs"
          >
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800">{{ q.leaveTypeName }} ({{ q.periodYear }})</span>
              <span class="badge bg-brand-100 text-brand-700 font-bold">
                Sisa: {{ q.balance }} hari
              </span>
            </div>
            <div class="grid grid-cols-4 gap-2 text-[11px] text-slate-600 border-t border-slate-200 pt-2 text-center">
              <div>
                <span class="text-slate-400 block">Dialokasikan</span>
                <strong>{{ q.allocated }}</strong>
              </div>
              <div>
                <span class="text-slate-400 block">Carry Over</span>
                <strong>{{ q.carriedOver }}</strong>
              </div>
              <div>
                <span class="text-slate-400 block">Dipesan</span>
                <strong>{{ q.reserved }}</strong>
              </div>
              <div>
                <span class="text-slate-400 block">Terpakai</span>
                <strong>{{ q.used }}</strong>
              </div>
            </div>
          </div>
        </div>
        <AppEmptyState
          v-else
          title="Belum ada kuota"
          description="Pegawai belum memiliki jatah kuota cuti tahun ini."
        />
      </div>
    </div>

    <!-- Modal Password Baru Setelah Reset -->
    <Teleport to="body">
      <div v-if="resetModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" />
        <div class="card relative z-10 w-full max-w-sm p-6 shadow-xl space-y-4">
          <h3 class="text-base font-bold text-slate-900">Kata Sandi Berhasil Direset</h3>
          <p class="text-xs text-slate-500">Berikan kredensial baru berikut kepada pegawai:</p>
          <div class="rounded-lg bg-slate-50 border border-slate-200 p-3 font-mono text-xs space-y-1">
            <p>Username: <strong>{{ resetModal.username }}</strong></p>
            <p>Password Baru: <strong class="text-brand-600 bg-white px-1.5 py-0.5 rounded border">{{ resetModal.temporaryPassword }}</strong></p>
          </div>
          <button
            type="button"
            class="btn-primary w-full text-xs"
            @click="resetModal = null"
          >
            Tutup
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Dialog Konfirmasi Nonaktifkan Pegawai -->
    <Teleport to="body">
      <div v-if="showDeactivateDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" @click="showDeactivateDialog = false" />
        <div class="card relative z-10 w-full max-w-sm p-6 shadow-xl space-y-4">
          <h3 class="text-base font-bold text-red-700">Nonaktifkan Pegawai</h3>
          <p class="text-xs text-slate-600 leading-relaxed">
            Pegawai yang dinonaktifkan tidak akan dapat login lagi, seluruh sesi aktif akan dicabut, dan pengajuan draf akan dibatalkan.
          </p>
          <AppFormField label="Tanggal Efektif Berakhir (End Date)" required>
            <input v-model="deactivateEndDate" type="date" class="input text-xs" required />
          </AppFormField>
          <div class="flex gap-2 justify-end pt-2">
            <button
              type="button"
              class="btn-ghost text-xs"
              :disabled="isDeactivating"
              @click="showDeactivateDialog = false"
            >
              Batal
            </button>
            <button
              type="button"
              class="btn bg-red-600 text-white hover:bg-red-700 text-xs"
              :disabled="isDeactivating"
              @click="handleDeactivateConfirm"
            >
              {{ isDeactivating ? 'Memproses...' : 'Ya, Nonaktifkan' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
