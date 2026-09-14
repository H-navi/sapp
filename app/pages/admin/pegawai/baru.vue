<script setup lang="ts">
useHead({
  title: 'Tambah Pegawai Baru',
})

const router = useRouter()

// Fetch master data untuk dropdown form
const { data: deptData } = await useFetch<{ data: Array<{ id: string; name: string }> }>('/api/admin/departments')
const { data: posData } = await useFetch<{ data: Array<{ id: string; name: string; level: number }> }>('/api/admin/positions')
const { data: empListData } = await useFetch<{ data: { items: Array<{ id: string; fullName: string; nip: string }> } }>('/api/admin/employees', {
  query: { perPage: 100, isActive: true },
})

const departments = computed(() => deptData.value?.data ?? [])
const positions = computed(() => posData.value?.data ?? [])
const managers = computed(() => empListData.value?.data?.items ?? [])

// State form
const form = reactive({
  nip: '',
  fullName: '',
  email: '',
  phone: '',
  gender: 'MALE' as 'MALE' | 'FEMALE',
  birthDate: '',
  departmentId: '',
  positionId: '',
  managerId: '',
  employmentStatus: 'PERMANENT' as 'PERMANENT' | 'CONTRACT' | 'PROBATION' | 'INTERN' | 'OUTSOURCE',
  joinDate: new Date().toISOString().split('T')[0],
  endDate: '',
  canSubmitRequest: true,
  telegramChatId: '',
  isActive: true,
})

// Accordion section aktif
const activeSection = ref<'personal' | 'employment' | 'access'>('personal')

const isLoading = ref(false)
const errorMessage = ref('')

// Modal sukses akun baru
const createdAccount = ref<{ username: string; temporaryPassword: string } | null>(null)
const isCopied = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  isLoading.value = true

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

    const res = await $fetch<{ data: { employee: any; username: string; temporaryPassword: string } }>('/api/admin/employees', {
      method: 'POST',
      body: payload,
    })

    createdAccount.value = {
      username: res.data.username,
      temporaryPassword: res.data.temporaryPassword,
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.statusMessage || 'Gagal menambahkan pegawai.'
  } finally {
    isLoading.value = false
  }
}

async function copyCredentials() {
  if (!createdAccount.value) return
  const text = `Username: ${createdAccount.value.username}\nPassword Sementara: ${createdAccount.value.temporaryPassword}`
  await navigator.clipboard.writeText(text)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}

function handleDone() {
  createdAccount.value = null
  router.push('/admin/pegawai')
}
</script>

<template>
  <div class="space-y-4">
    <AppPageHeader
      title="Tambah Pegawai Baru"
      subtitle="Membuat profil pegawai dan akun login otomatis"
    >
      <template #actions>
        <NuxtLink to="/admin/pegawai" class="btn-ghost text-xs px-3 py-2">
          Kembali
        </NuxtLink>
      </template>
    </AppPageHeader>

    <div v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <p class="font-medium">{{ errorMessage }}</p>
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Section 1: Data Diri -->
      <div class="card p-4">
        <button
          type="button"
          class="flex w-full items-center justify-between font-semibold text-slate-900 text-sm"
          @click="activeSection = activeSection === 'personal' ? '' as any : 'personal'"
        >
          <span>1. Data Diri Pegawai</span>
          <span class="text-slate-400">{{ activeSection === 'personal' ? '▲' : '▼' }}</span>
        </button>

        <div v-show="activeSection === 'personal'" class="mt-4 space-y-3 pt-3 border-t border-slate-100">
          <AppFormField label="Nomor Induk Pegawai (NIP)" required>
            <input v-model="form.nip" type="text" required placeholder="Contoh: EMP011" class="input" />
          </AppFormField>

          <AppFormField label="Nama Lengkap" required>
            <input v-model="form.fullName" type="text" required placeholder="Nama lengkap pegawai" class="input" />
          </AppFormField>

          <AppFormField label="Alamat Email Perusahaan" required>
            <input v-model="form.email" type="email" required placeholder="nama@perusahaan.co.id" class="input" />
          </AppFormField>

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

          <div class="grid grid-cols-2 gap-3">
            <AppFormField label="Nomor Telepon / WhatsApp">
              <input v-model="form.phone" type="tel" placeholder="08xxxxxxxx" class="input" />
            </AppFormField>

            <AppFormField label="Telegram Chat ID (Opsional)">
              <input v-model="form.telegramChatId" type="text" placeholder="Contoh: 123456789" class="input" />
            </AppFormField>
          </div>
        </div>
      </div>

      <!-- Section 2: Kepegawaian -->
      <div class="card p-4">
        <button
          type="button"
          class="flex w-full items-center justify-between font-semibold text-slate-900 text-sm"
          @click="activeSection = activeSection === 'employment' ? '' as any : 'employment'"
        >
          <span>2. Struktur & Kepegawaian</span>
          <span class="text-slate-400">{{ activeSection === 'employment' ? '▲' : '▼' }}</span>
        </button>

        <div v-show="activeSection === 'employment'" class="mt-4 space-y-3 pt-3 border-t border-slate-100">
          <AppFormField label="Departemen">
            <select v-model="form.departmentId" class="input">
              <option value="">Pilih Departemen</option>
              <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </AppFormField>

          <AppFormField label="Jabatan">
            <select v-model="form.positionId" class="input">
              <option value="">Pilih Jabatan</option>
              <option v-for="p in positions" :key="p.id" :value="p.id">{{ p.name }} (Level {{ p.level }})</option>
            </select>
          </AppFormField>

          <AppFormField label="Atasan Langsung (Manager)">
            <select v-model="form.managerId" class="input">
              <option value="">Tanpa Atasan (Tertinggi / Direktur)</option>
              <option v-for="m in managers" :key="m.id" :value="m.id">{{ m.fullName }} ({{ m.nip }})</option>
            </select>
          </AppFormField>

          <div class="grid grid-cols-2 gap-3">
            <AppFormField label="Status Hubungan Kerja" required>
              <select v-model="form.employmentStatus" class="input">
                <option value="PERMANENT">Karyawan Tetap</option>
                <option value="CONTRACT">Kontrak (PKWT)</option>
                <option value="PROBATION">Masa Percobaan</option>
                <option value="INTERN">Magang</option>
                <option value="OUTSOURCE">Outsource</option>
              </select>
            </AppFormField>

            <AppFormField label="Tanggal Bergabung" required>
              <input v-model="form.joinDate" type="date" required class="input" />
            </AppFormField>
          </div>

          <AppFormField label="Tanggal Berakhir (Bila Kontrak/Magang)">
            <input v-model="form.endDate" type="date" class="input" />
          </AppFormField>
        </div>
      </div>

      <!-- Section 3: Hak Akses & Status -->
      <div class="card p-4">
        <button
          type="button"
          class="flex w-full items-center justify-between font-semibold text-slate-900 text-sm"
          @click="activeSection = activeSection === 'access' ? '' as any : 'access'"
        >
          <span>3. Hak Akses & Status Akun</span>
          <span class="text-slate-400">{{ activeSection === 'access' ? '▲' : '▼' }}</span>
        </button>

        <div v-show="activeSection === 'access'" class="mt-4 space-y-3 pt-3 border-t border-slate-100">
          <AppToggle
            v-model="form.canSubmitRequest"
            label="Izinkan Pegawai Mengajukan Perizinan"
          />

          <AppToggle
            v-model="form.isActive"
            label="Akun dan Pegawai Berstatus Aktif"
          />

          <div class="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 border border-blue-200">
            <p class="font-medium">Catatan Pembuatan Akun Otomatis:</p>
            <p class="mt-1">Akun login akan otomatis dibuat dengan role <strong>EMPLOYEE</strong>. Kata sandi acak sementara akan dimunculkan setelah tombol simpan ditekan.</p>
          </div>
        </div>
      </div>

      <div class="pt-2">
        <button
          type="submit"
          :disabled="isLoading"
          class="btn-primary w-full py-3 text-base shadow-sm"
        >
          <span v-if="isLoading">Menyimpan Data Pegawai...</span>
          <span v-else>Simpan & Buat Akun Pegawai</span>
        </button>
      </div>
    </form>

    <!-- Dialog Kredensial Akun Baru -->
    <Teleport to="body">
      <div v-if="createdAccount" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" />
        <div class="card relative z-10 w-full max-w-md p-6 shadow-xl space-y-4">
          <div class="text-center">
            <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 class="text-base font-bold text-slate-900">Pegawai & Akun Berhasil Dibuat</h3>
            <p class="mt-1 text-xs text-slate-500">Berikan kredensial login sementara berikut kepada pegawai:</p>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm font-mono">
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-500 font-sans">Username:</span>
              <span class="font-semibold text-slate-800">{{ createdAccount.username }}</span>
            </div>
            <div class="flex justify-between items-center border-t border-slate-200 pt-2">
              <span class="text-xs text-slate-500 font-sans">Password Sementara:</span>
              <span class="font-semibold text-brand-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                {{ createdAccount.temporaryPassword }}
              </span>
            </div>
          </div>

          <p class="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            ⚠️ <strong>Penting:</strong> Password sementara ini hanya ditampilkan sekali ini saja. Pengguna akan diwajibkan mengganti kata sandi pada saat login pertama.
          </p>

          <div class="flex flex-col gap-2 pt-2 sm:flex-row">
            <button
              type="button"
              class="btn-ghost flex-1"
              @click="copyCredentials"
            >
              {{ isCopied ? 'Tersalin!' : 'Salin Kredensial' }}
            </button>
            <button
              type="button"
              class="btn-primary flex-1"
              @click="handleDone"
            >
              Selesai & Ke Daftar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
