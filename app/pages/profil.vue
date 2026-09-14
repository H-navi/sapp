<script setup lang="ts">
useHead({
  title: 'Profil Saya',
})

const { user, logout } = useAuth()
const isLoggingOut = ref(false)

// Status Telegram
const { data: tgStatus, refresh: refreshTgStatus } = await useFetch<{ isLinked: boolean; chatId: string | null; botConfigured: boolean }>('/api/profile/telegram/status')

// Preferensi Notifikasi
const { data: prefRes, refresh: refreshPrefs } = await useFetch<{ data: any }>('/api/profile/preferences')
const prefs = reactive({
  emailEnabled: true,
  telegramEnabled: true,
  quietHoursStart: '',
  quietHoursEnd: '',
})

watchEffect(() => {
  if (prefRes.value?.data) {
    prefs.emailEnabled = prefRes.value.data.emailEnabled ?? true
    prefs.telegramEnabled = prefRes.value.data.telegramEnabled ?? true
    prefs.quietHoursStart = prefRes.value.data.quietHoursStart || ''
    prefs.quietHoursEnd = prefRes.value.data.quietHoursEnd || ''
  }
})

// Modal Penautan Telegram
const showTgModal = ref(false)
const tgLoading = ref(false)
const tgLinkData = ref<{ deepLink: string; botUsername: string; token: string; isBotConfigured: boolean } | null>(null)
const isUnlinking = ref(false)
const isSavingPrefs = ref(false)
const saveSuccess = ref(false)

let pollTimer: any = null

async function openTelegramModal() {
  tgLoading.value = true
  showTgModal.value = true

  try {
    const res = await $fetch<any>('/api/profile/telegram/generate-link', { method: 'POST' })
    tgLinkData.value = res

    // Polling status penautan setiap 3 detik selama modal terbuka
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(async () => {
      await refreshTgStatus()
      if (tgStatus.value?.isLinked) {
        clearInterval(pollTimer)
        pollTimer = null
        showTgModal.value = false
      }
    }, 3000)
  } catch (err) {
    console.error(err)
  } finally {
    tgLoading.value = false
  }
}

function closeTgModal() {
  showTgModal.value = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

async function handleUnlinkTelegram() {
  if (!confirm('Apakah Anda yakin ingin memutuskan notifikasi Telegram?')) return
  isUnlinking.value = true
  try {
    await $fetch('/api/profile/telegram/unlink', { method: 'DELETE' })
    await refreshTgStatus()
  } catch (err) {
    console.error(err)
  } finally {
    isUnlinking.value = false
  }
}

async function handleSavePreferences() {
  isSavingPrefs.value = true
  saveSuccess.value = false

  try {
    await $fetch('/api/profile/preferences', {
      method: 'PATCH',
      body: {
        emailEnabled: prefs.emailEnabled,
        telegramEnabled: prefs.telegramEnabled,
        quietHoursStart: prefs.quietHoursStart || null,
        quietHoursEnd: prefs.quietHoursEnd || null,
      },
    })
    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
    await refreshPrefs()
  } catch (err: any) {
    alert(err.data?.message || 'Gagal menyimpan preferensi')
  } finally {
    isSavingPrefs.value = false
  }
}

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
  <div class="space-y-5">
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

    <!-- Integrasi Telegram Notifikasi -->
    <div class="card space-y-4">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="font-semibold text-slate-900 text-sm">Notifikasi Telegram Bot</h3>
          <p class="text-xs text-slate-500 mt-0.5">Terima pemberitahuan tugas approval, pengingat SLA, dan hasil izin langsung di Telegram</p>
        </div>
        <span
          class="badge border text-xs"
          :class="tgStatus?.isLinked ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'"
        >
          {{ tgStatus?.isLinked ? 'Terhubung' : 'Belum Terhubung' }}
        </span>
      </div>

      <div v-if="tgStatus?.isLinked" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-slate-50 p-3.5 border border-slate-100 text-xs">
        <div>
          <span class="font-semibold text-slate-700">Chat ID Telegram:</span>
          <code class="ml-2 font-mono bg-white px-2 py-0.5 rounded border text-slate-600">{{ tgStatus.chatId }}</code>
        </div>
        <button
          class="text-rose-600 hover:text-rose-800 font-medium self-start sm:self-auto"
          :disabled="isUnlinking"
          @click="handleUnlinkTelegram"
        >
          {{ isUnlinking ? 'Memutuskan...' : 'Putuskan Sambungan' }}
        </button>
      </div>

      <div v-else class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="text-xs text-slate-500">
          Tautkan akun Telegram Anda untuk notifikasi instan tanpa perlu membuka email.
        </p>
        <button class="btn btn-brand text-xs whitespace-nowrap" @click="openTelegramModal">
          <svg class="h-4 w-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.93-1.28 4.88-2.12 5.86-2.54 2.79-1.19 3.37-1.4 3.75-1.4.08 0 .28.02.4.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
          Hubungkan Telegram
        </button>
      </div>
    </div>

    <!-- Preferensi Saluran & Jam Tenang -->
    <div class="card space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 class="font-semibold text-slate-900 text-sm">Preferensi & Jam Tenang</h3>
          <p class="text-xs text-slate-500">Pilih saluran yang ingin Anda aktifkan dan atur batas waktu bebas notifikasi</p>
        </div>
      </div>

      <div class="space-y-3 text-sm">
        <label class="flex items-center justify-between py-1 cursor-pointer">
          <div>
            <span class="font-medium text-slate-800">Notifikasi Email</span>
            <p class="text-xs text-slate-500">Kirim email untuk tugas baru dan pengingat</p>
          </div>
          <input v-model="prefs.emailEnabled" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500">
        </label>

        <label class="flex items-center justify-between py-1 cursor-pointer border-t border-slate-100 pt-3">
          <div>
            <span class="font-medium text-slate-800">Notifikasi Telegram</span>
            <p class="text-xs text-slate-500">Kirim pesan Telegram langsung ke akun yang tertaut</p>
          </div>
          <input v-model="prefs.telegramEnabled" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500">
        </label>

        <div class="border-t border-slate-100 pt-3">
          <label class="block font-medium text-slate-800 text-xs mb-1">Jam Tenang (Quiet Hours)</label>
          <p class="text-xs text-slate-500 mb-2">Pemberitahuan pengingat pada rentang jam ini akan ditunda sampai jam tenang berakhir (kecuali hasil keputusan akhir).</p>
          <div class="flex items-center gap-2">
            <input v-model="prefs.quietHoursStart" type="time" class="input py-1 text-xs w-32" placeholder="22:00">
            <span class="text-xs text-slate-400">sampai</span>
            <input v-model="prefs.quietHoursEnd" type="time" class="input py-1 text-xs w-32" placeholder="06:00">
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
        <span v-if="saveSuccess" class="text-xs text-emerald-600 font-medium">✓ Preferensi berhasil disimpan.</span>
        <span v-else />
        <button
          class="btn btn-brand text-xs px-4"
          :disabled="isSavingPrefs"
          @click="handleSavePreferences"
        >
          {{ isSavingPrefs ? 'Menyimpan...' : 'Simpan Preferensi' }}
        </button>
      </div>
    </div>

    <!-- Keamanan Kata Sandi -->
    <div class="card space-y-3">
      <h3 class="font-semibold text-slate-900 text-sm">Keamanan Akun</h3>
      <div class="flex items-center justify-between py-1">
        <div>
          <p class="text-sm font-medium text-slate-800">Kata Sandi</p>
          <p class="text-xs text-slate-500">Perbarui kata sandi login Anda secara berkala</p>
        </div>
        <NuxtLink to="/ganti-password" class="btn-ghost text-xs px-3 py-1.5 border">
          Ubah Password
        </NuxtLink>
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
        {{ isLoggingOut ? 'Sedang keluar...' : 'Keluar dari Akun' }}
      </button>
    </div>

    <!-- Modal Hubungkan Telegram -->
    <div v-if="showTgModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div class="card w-full max-w-md p-6 space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-base font-bold text-slate-900">Hubungkan Akun Telegram</h3>
            <p class="text-xs text-slate-500">Ikuti langkah sederhana berikut untuk menautkan bot</p>
          </div>
          <button class="text-slate-400 hover:text-slate-600" @click="closeTgModal">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div v-if="tgLoading" class="py-8 text-center text-xs text-slate-400">
          Membuat token penautan...
        </div>

        <div v-else-if="tgLinkData" class="space-y-4 text-xs">
          <div class="rounded-lg bg-blue-50 p-3.5 border border-blue-100 text-blue-900 space-y-2">
            <p class="font-semibold text-xs">Langkah 1: Buka Bot Telegram</p>
            <p>Klik tombol di bawah ini untuk membuka Telegram dan secara otomatis mengirim kode penautan:</p>
            <a
              :href="tgLinkData.deepLink"
              target="_blank"
              class="btn btn-brand text-xs w-full text-center flex items-center justify-center gap-2 mt-2"
            >
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.93-1.28 4.88-2.12 5.86-2.54 2.79-1.19 3.37-1.4 3.75-1.4.08 0 .28.02.4.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Buka @{{ tgLinkData.botUsername }} di Telegram
            </a>
          </div>

          <div class="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1.5">
            <p class="font-semibold text-slate-700">Atau kirim manual:</p>
            <p class="text-slate-500">Cari bot <b>@{{ tgLinkData.botUsername }}</b> di Telegram lalu kirim perintah:</p>
            <div class="flex items-center justify-between bg-white border rounded p-2 font-mono text-[11px]">
              <code>/start {{ tgLinkData.token }}</code>
            </div>
            <p class="text-[11px] text-slate-400 italic">Token ini berlaku selama 15 menit.</p>
          </div>

          <div class="text-center text-slate-400 text-[11px] flex items-center justify-center gap-1.5">
            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Menunggu konfirmasi dari bot Telegram...
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button class="btn btn-secondary text-xs" @click="closeTgModal">
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
