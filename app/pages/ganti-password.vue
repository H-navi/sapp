<script setup lang="ts">
useHead({
  title: 'Ganti Kata Sandi',
})

const { user, fetchMe } = useAuth()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const hasLength = computed(() => newPassword.value.length >= 8)
const hasLetter = computed(() => /[a-zA-Z]/.test(newPassword.value))
const hasNumber = computed(() => /[0-9]/.test(newPassword.value))
const isMatch = computed(() => newPassword.value.length > 0 && newPassword.value === confirmPassword.value)
const isDifferent = computed(() => newPassword.value.length > 0 && newPassword.value !== oldPassword.value)

const isFormValid = computed(() => {
  return hasLength.value && hasLetter.value && hasNumber.value && isMatch.value && isDifferent.value && oldPassword.value.length > 0
})

async function handleChangePassword() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!isFormValid.value) {
    errorMessage.value = 'Mohon penuhi seluruh persyaratan kata sandi baru.'
    return
  }

  isLoading.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: {
        oldPassword: oldPassword.value,
        newPassword: newPassword.value,
        confirmPassword: confirmPassword.value,
      },
    })
    successMessage.value = 'Kata sandi berhasil diperbarui! Mengalihkan...'
    await fetchMe()
    setTimeout(async () => {
      await navigateTo('/')
    }, 1200)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.statusMessage || 'Gagal mengubah kata sandi.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">Pembaruan Kata Sandi</h1>
      <p class="mt-1 text-sm text-slate-500">
        {{ user?.mustChangePassword ? 'Anda wajib mengubah kata sandi sebelum dapat melanjutkan penggunaan sistem.' : 'Perbarui kata sandi akun Anda secara berkala untuk menjaga keamanan.' }}
      </p>
    </div>

    <div v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <p class="font-medium">{{ errorMessage }}</p>
    </div>

    <div v-if="successMessage" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
      <p class="font-medium">{{ successMessage }}</p>
    </div>

    <div class="card space-y-4">
      <form class="space-y-4" @submit.prevent="handleChangePassword">
        <div>
          <label for="oldPassword" class="label">Kata Sandi Saat Ini</label>
          <input
            id="oldPassword"
            v-model="oldPassword"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="input"
          />
        </div>

        <div>
          <label for="newPassword" class="label">Kata Sandi Baru</label>
          <input
            id="newPassword"
            v-model="newPassword"
            type="password"
            required
            autocomplete="new-password"
            placeholder="Minimal 8 karakter (huruf & angka)"
            class="input"
          />
        </div>

        <div>
          <label for="confirmPassword" class="label">Konfirmasi Kata Sandi Baru</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            autocomplete="new-password"
            placeholder="Ketik ulang kata sandi baru"
            class="input"
          />
        </div>

        <!-- Indikator Persyaratan Password -->
        <div class="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-200 space-y-1.5">
          <p class="font-medium text-slate-700 mb-1">Ketentuan Keamanan:</p>
          <div class="flex items-center gap-2" :class="hasLength ? 'text-status-approved font-medium' : 'text-slate-500'">
            <span>{{ hasLength ? '✓' : '•' }} Minimal 8 karakter</span>
          </div>
          <div class="flex items-center gap-2" :class="hasLetter ? 'text-status-approved font-medium' : 'text-slate-500'">
            <span>{{ hasLetter ? '✓' : '•' }} Mengandung huruf (A-Z / a-z)</span>
          </div>
          <div class="flex items-center gap-2" :class="hasNumber ? 'text-status-approved font-medium' : 'text-slate-500'">
            <span>{{ hasNumber ? '✓' : '•' }} Mengandung angka (0-9)</span>
          </div>
          <div class="flex items-center gap-2" :class="isDifferent ? 'text-status-approved font-medium' : 'text-slate-500'">
            <span>{{ isDifferent ? '✓' : '•' }} Berbeda dari kata sandi lama</span>
          </div>
          <div class="flex items-center gap-2" :class="isMatch ? 'text-status-approved font-medium' : 'text-slate-500'">
            <span>{{ isMatch ? '✓' : '•' }} Konfirmasi kata sandi cocok</span>
          </div>
        </div>

        <button
          type="submit"
          :disabled="isLoading || !isFormValid"
          class="btn-primary w-full py-2.5"
        >
          <span v-if="isLoading">Menyimpan...</span>
          <span v-else>Simpan Kata Sandi Baru</span>
        </button>
      </form>
    </div>
  </div>
</template>
