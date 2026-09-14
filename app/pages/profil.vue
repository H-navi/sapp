<script setup lang="ts">
useHead({
  title: 'Profil Saya',
})

const { user, logout } = useAuth()
const isLoggingOut = ref(false)

async function handleLogout() {
  isLoggingOut.value = true
  try {
    await logout()
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-slate-900">Profil Saya</h1>
    </div>

    <!-- Info Utama -->
    <div class="card space-y-4">
      <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-lg">
          {{ user?.fullName?.charAt(0).toUpperCase() ?? 'U' }}
        </div>
        <div>
          <h2 class="font-semibold text-slate-900 text-base">{{ user?.fullName ?? 'Pengguna' }}</h2>
          <p class="text-xs text-slate-500">@{{ user?.username ?? '-' }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <p class="text-xs text-slate-500">Role / Hak Akses</p>
          <div class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="role in user?.roles ?? []"
              :key="role"
              class="badge bg-brand-50 text-brand-700 font-medium"
            >
              {{ role }}
            </span>
          </div>
        </div>

        <div>
          <p class="text-xs text-slate-500">ID Pegawai</p>
          <p class="font-medium text-slate-800">{{ user?.employeeId ? user.employeeId.slice(0, 8) + '...' : 'Akun Sistem' }}</p>
        </div>

        <div>
          <p class="text-xs text-slate-500">Level Jabatan</p>
          <p class="font-medium text-slate-800">{{ user?.positionLevel ? 'Level ' + user.positionLevel : '-' }}</p>
        </div>

        <div>
          <p class="text-xs text-slate-500">Status Keamanan</p>
          <p class="font-medium" :class="user?.mustChangePassword ? 'text-status-pending' : 'text-status-approved'">
            {{ user?.mustChangePassword ? 'Wajib ganti password' : 'Aman' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Pengaturan Akun & Keamanan -->
    <div class="card space-y-3">
      <h3 class="font-semibold text-slate-900 text-sm">Keamanan & Notifikasi</h3>

      <div class="flex items-center justify-between py-1">
        <div>
          <p class="text-sm font-medium text-slate-800">Kata Sandi</p>
          <p class="text-xs text-slate-500">Ubah kata sandi login Anda</p>
        </div>
        <NuxtLink to="/ganti-password" class="btn-ghost text-xs px-3 py-1.5">
          Ubah
        </NuxtLink>
      </div>

      <div class="border-t border-slate-100 pt-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-slate-800">Telegram Notifikasi</p>
          <p class="text-xs text-slate-500">Terima reminder & status izin via Telegram</p>
        </div>
        <span class="badge bg-slate-100 text-slate-600 text-xs">Langkah 10</span>
      </div>
    </div>

    <!-- Tombol Logout -->
    <div class="pt-2">
      <button
        type="button"
        :disabled="isLoggingOut"
        class="btn border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 w-full"
        @click="handleLogout"
      >
        <span v-if="isLoggingOut">Keluar...</span>
        <span v-else>Keluar dari Akun</span>
      </button>
    </div>
  </div>
</template>
