<script setup lang="ts">
const { t } = useI18n()
const { user, logout } = useAuth()

useHead({
  title: computed(() => t('profile.myProfile')),
})

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
const tgError = ref('')
const tgLinkData = ref<{ deepLink: string; botUsername: string; token: string; isBotConfigured: boolean } | null>(null)
const isUnlinking = ref(false)
const isSavingPrefs = ref(false)
const saveSuccess = ref(false)
const copiedToken = ref(false)

// Pengujian Email & Telegram
const isTestingEmail = ref(false)
const isTestingTg = ref(false)
const toast = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  toast.value = { type, text }
  setTimeout(() => {
    toast.value = null
  }, 5000)
}

let pollTimer: any = null

async function openTelegramModal() {
  tgLoading.value = true
  tgError.value = ''
  tgLinkData.value = null
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
        showToast(t('profile.telegramLinked'), 'success')
      }
    }, 3000)
  } catch (err: any) {
    tgError.value = err?.data?.message || err?.message || 'Gagal membuat tautan penautan Telegram.'
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

function copyStartCommand() {
  if (!tgLinkData.value) return
  const cmd = `/start ${tgLinkData.value.token}`
  navigator.clipboard.writeText(cmd)
  copiedToken.value = true
  setTimeout(() => {
    copiedToken.value = false
  }, 2500)
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
    showToast(t('profile.telegramNotLinked'), 'info')
  } catch (err: any) {
    showToast(err?.data?.message || err?.message || 'Gagal memutuskan sambungan Telegram.', 'error')
  } finally {
    isUnlinking.value = false
  }
}

async function handleTestTelegram() {
  isTestingTg.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string; simulated?: boolean }>('/api/profile/test-telegram', {
      method: 'POST',
    })
    showToast(res.message, res.simulated ? 'info' : 'success')
  } catch (err: any) {
    showToast(err?.data?.message || err?.message || 'Gagal mengirim Telegram uji.', 'error')
  } finally {
    isTestingTg.value = false
  }
}

async function handleTestEmail() {
  isTestingEmail.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string; simulated?: boolean }>('/api/profile/test-email', {
      method: 'POST',
    })
    showToast(res.message, res.simulated ? 'info' : 'success')
  } catch (err: any) {
    showToast(err?.data?.message || err?.message || 'Gagal mengirim email uji.', 'error')
  } finally {
    isTestingEmail.value = false
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
    showToast(t('common.success'), 'success')
    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
    await refreshPrefs()
  } catch (err: any) {
    showToast(err?.data?.message || t('common.error'), 'error')
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
  <div class="space-y-5 pb-12 max-w-4xl mx-auto">
    <!-- Floating Toast Notification -->
    <transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast"
        :class="{
          'bg-emerald-700 text-white': toast.type === 'success',
          'bg-rose-700 text-white': toast.type === 'error',
          'bg-blue-700 text-white': toast.type === 'info',
        }"
        class="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-medium border border-white/20"
      >
        <span>{{ toast.text }}</span>
        <button type="button" class="opacity-80 hover:opacity-100 font-bold" @click="toast = null">✕</button>
      </div>
    </transition>

    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-slate-900">{{ t('profile.myProfile') }}</h1>
    </div>

    <!-- Info Utama Akun -->
    <div class="card space-y-4">
      <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-lg">
          {{ user?.fullName?.charAt(0).toUpperCase() ?? 'U' }}
        </div>
        <div>
          <h2 class="font-semibold text-slate-900 text-base">{{ user?.fullName ?? 'User' }}</h2>
          <p class="text-xs text-slate-500">@{{ user?.username ?? '-' }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
        <div>
          <p class="text-xs text-slate-500">Role / Hak Akses</p>
          <div class="flex flex-wrap gap-1 mt-1">
            <span
              v-for="role in user?.roles ?? []"
              :key="role"
              class="badge bg-brand-50 text-brand-700 font-medium text-xs"
            >
              {{ role }}
            </span>
          </div>
        </div>

        <div>
          <p class="text-xs text-slate-500">ID Pegawai</p>
          <p class="font-medium text-slate-800 text-xs mt-1">{{ user?.employeeId ? user.employeeId.slice(0, 8) + '...' : 'System Account' }}</p>
        </div>

        <div>
          <p class="text-xs text-slate-500">{{ t('profile.position') }}</p>
          <p class="font-medium text-slate-800 text-xs mt-1">{{ user?.positionLevel ? 'Level ' + user.positionLevel : '-' }}</p>
        </div>

        <div>
          <p class="text-xs text-slate-500">Status Keamanan</p>
          <p class="font-medium text-xs mt-1" :class="user?.mustChangePassword ? 'text-status-pending' : 'text-status-approved'">
            {{ user?.mustChangePassword ? 'Wajib ganti password' : 'Aman' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Preferensi Bahasa (Language Switcher Card) -->
    <div class="card space-y-4">
      <div class="border-b border-slate-100 pb-3">
        <h3 class="font-semibold text-slate-900 text-sm flex items-center gap-2">
          <span>🌐</span>
          <span>{{ t('profile.languagePrefs') }}</span>
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">
          {{ t('profile.languagePrefsDesc') }}
        </p>
      </div>

      <AppLanguageSwitcher variant="card" />
    </div>

    <!-- Integrasi Telegram Notifikasi -->
    <div class="card space-y-4">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-slate-900 text-sm">{{ t('profile.telegramNotif') }}</h3>
            <span
              class="badge text-[11px] font-bold"
              :class="tgStatus?.isLinked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'"
            >
              {{ tgStatus?.isLinked ? t('profile.telegramLinked') : t('profile.telegramNotLinked') }}
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">
            {{ t('profile.telegramNotifDesc') }}
          </p>
        </div>
      </div>

      <!-- Jika sudah terhubung -->
      <div v-if="tgStatus?.isLinked" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-emerald-50/50 p-4 border border-emerald-100 text-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <span class="font-bold text-slate-800">{{ t('profile.telegramLinked') }}:</span>
            <code class="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-slate-700 font-semibold">
              Chat ID: {{ tgStatus.chatId }}
            </code>
          </div>
          <p class="text-slate-500 mt-1">Notifikasi otomatis aktif ke obrolan Telegram Anda.</p>
        </div>
        <div class="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            :disabled="isTestingTg"
            class="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-sky-700 border-sky-200 hover:bg-sky-50"
            @click="handleTestTelegram"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {{ isTestingTg ? t('common.processing') : t('profile.testTelegram') }}
          </button>
          <button
            type="button"
            :disabled="isUnlinking"
            class="text-rose-600 hover:text-rose-800 font-medium px-2 py-1.5 text-xs"
            @click="handleUnlinkTelegram"
          >
            {{ isUnlinking ? t('common.processing') : t('profile.unlinkTelegram') }}
          </button>
        </div>
      </div>

      <!-- Jika belum terhubung -->
      <div v-else class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
        <p class="text-xs text-slate-600">
          Tautkan akun Telegram Anda untuk notifikasi instan tanpa perlu membuka email.
        </p>
        <button
          type="button"
          class="btn btn-brand text-xs whitespace-nowrap flex items-center gap-2"
          @click="openTelegramModal"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.93-1.28 4.88-2.12 5.86-2.54 2.79-1.19 3.37-1.4 3.75-1.4.08 0 .28.02.4.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
          {{ t('profile.linkTelegram') }}
        </button>
      </div>
    </div>

    <!-- Preferensi Saluran & Uji Pengiriman Email -->
    <div class="card space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 class="font-semibold text-slate-900 text-sm">{{ t('profile.notificationPrefs') }}</h3>
          <p class="text-xs text-slate-500">Pilih saluran yang ingin Anda aktifkan dan uji pengiriman ke email Anda</p>
        </div>
      </div>

      <!-- Email Channel Setting & Test Button -->
      <div class="space-y-3 text-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-100 pb-3">
          <div>
            <span class="font-medium text-slate-800 text-xs sm:text-sm">{{ t('profile.emailNotif') }}</span>
            <p class="text-xs text-slate-500">{{ t('profile.emailNotifDesc') }}</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="isTestingEmail"
              class="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
              @click="handleTestEmail"
            >
              <svg
                :class="{ 'animate-spin': isTestingEmail }"
                class="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {{ isTestingEmail ? t('common.processing') : t('profile.testEmail') }}
            </button>
            <input
              v-model="prefs.emailEnabled"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          </div>
        </div>

        <!-- Telegram Notification Toggle -->
        <div class="flex items-center justify-between py-2 border-b border-slate-100 pb-3">
          <div>
            <span class="font-medium text-slate-800 text-xs sm:text-sm">{{ t('profile.telegramNotif') }}</span>
            <p class="text-xs text-slate-500">{{ t('profile.telegramNotifDesc') }}</p>
          </div>
          <input
            v-model="prefs.telegramEnabled"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
        </div>

        <!-- Jam Tenang (Quiet Hours) -->
        <div class="py-2 space-y-2">
          <label class="block text-xs font-semibold text-slate-700">{{ t('profile.quietHours') }}</label>
          <p class="text-xs text-slate-500">Notifikasi di jam ini akan ditunda sampai jam tenang berakhir.</p>
          <div class="flex items-center gap-3 max-w-xs">
            <input
              v-model="prefs.quietHoursStart"
              type="time"
              class="input text-xs"
            />
            <span class="text-xs text-slate-400">s/d</span>
            <input
              v-model="prefs.quietHoursEnd"
              type="time"
              class="input text-xs"
            />
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 flex justify-end">
        <button
          type="button"
          :disabled="isSavingPrefs"
          class="btn-primary text-xs"
          @click="handleSavePreferences"
        >
          <span v-if="isSavingPrefs" class="inline-flex items-center gap-1.5">
            <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {{ t('common.processing') }}
          </span>
          <span v-else>{{ t('common.save') }}</span>
        </button>
      </div>
    </div>

    <!-- Keamanan Akun -->
    <div class="card space-y-3">
      <h3 class="font-semibold text-slate-900 text-sm">Keamanan Akun</h3>
      <div class="flex items-center justify-between py-1">
        <div>
          <p class="text-sm font-medium text-slate-800">{{ t('auth.password') }}</p>
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
        {{ isLoggingOut ? t('common.processing') : t('nav.logout') }}
      </button>
    </div>

    <!-- Modal Hubungkan Telegram -->
    <div v-if="showTgModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div class="card w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div class="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-base font-bold text-slate-900">{{ t('profile.linkTelegram') }}</h3>
            <p class="text-xs text-slate-500">Ikuti langkah sederhana berikut untuk menautkan bot</p>
          </div>
          <button class="text-slate-400 hover:text-slate-600 text-lg font-bold" @click="closeTgModal">
            ✕
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="tgLoading" class="py-10 text-center text-xs text-slate-500 space-y-2">
          <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"></div>
          <div>Membuat token penautan akun...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="tgError" class="space-y-3 py-2">
          <div class="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 space-y-1">
            <div class="font-bold flex items-center gap-1.5">
              <svg class="h-4 w-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Gagal Menghubungkan Telegram
            </div>
            <p>{{ tgError }}</p>
          </div>
          <div class="flex justify-end gap-2">
            <button class="btn btn-secondary text-xs" @click="closeTgModal">{{ t('common.close') }}</button>
            <button class="btn btn-brand text-xs" @click="openTelegramModal">{{ t('common.retry') }}</button>
          </div>
        </div>

        <!-- Success Content -->
        <div v-else-if="tgLinkData" class="space-y-4 text-xs">
          <!-- Step 1: Deep Link Button -->
          <div class="rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 p-4 border border-blue-100 text-blue-950 space-y-2">
            <p class="font-bold text-xs flex items-center gap-1.5 text-blue-900">
              <span>Langkah 1:</span> Buka Obrolan Bot Telegram
            </p>
            <p class="text-slate-600 leading-relaxed">
              Klik tombol di bawah untuk membuka obrolan langsung di Telegram Anda:
            </p>
            <a
              :href="tgLinkData.deepLink"
              target="_blank"
              class="btn bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs w-full text-center flex items-center justify-center gap-2 mt-2 py-2.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
            >
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.93-1.28 4.88-2.12 5.86-2.54 2.79-1.19 3.37-1.4 3.75-1.4.08 0 .28.02.4.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Buka @{{ tgLinkData.botUsername }} di Telegram
            </a>
          </div>

          <!-- Step 2: Manual Fallback -->
          <div class="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-2">
            <p class="font-bold text-slate-700">Atau Kirim Perintah Manual:</p>
            <p class="text-slate-500">
              Buka bot <b>@{{ tgLinkData.botUsername }}</b> di Telegram lalu kirimkan pesan berikut:
            </p>
            <div class="flex items-center justify-between bg-white border border-slate-300 rounded-lg p-2 font-mono text-[11px]">
              <code class="text-brand-700 font-bold">/start {{ tgLinkData.token }}</code>
              <button
                type="button"
                class="btn-secondary text-[10px] py-1 px-2 text-slate-600 hover:text-slate-900"
                @click="copyStartCommand"
              >
                {{ copiedToken ? '✓ Tersalin!' : 'Salin' }}
              </button>
            </div>
            <p class="text-[11px] text-slate-400 italic">Token berlaku 15 menit.</p>
          </div>

          <!-- Polling State -->
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Menunggu Anda menekan <b>Start</b> di bot Telegram...</span>
          </div>

          <div class="flex justify-end pt-2">
            <button class="btn btn-secondary text-xs" @click="closeTgModal">
              {{ t('common.close') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
