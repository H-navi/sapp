<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

useHead({
  title: 'Masuk',
})

const { login } = useAuth()
const route = useRoute()

const identifier = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  errorMessage.value = ''
  if (!identifier.value || !password.value) {
    errorMessage.value = 'Email/username dan password wajib diisi.'
    return
  }

  isLoading.value = true
  try {
    await login(identifier.value, password.value)
    const redirect = route.query.redirect as string | undefined
    if (redirect && redirect.startsWith('/')) {
      await navigateTo(redirect)
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.statusMessage || 'Gagal masuk. Periksa kembali data Anda.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="card w-full shadow-md border-slate-200 p-6 sm:p-8">
    <div class="mb-6 text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Masuk ke Akun</h1>
      <p class="mt-1 text-sm text-slate-500">Sistem Auto Approval Perizinan Pegawai</p>
    </div>

    <div v-if="errorMessage" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <p class="font-medium">{{ errorMessage }}</p>
    </div>

    <form class="space-y-4" @submit.prevent="handleLogin">
      <div>
        <label for="identifier" class="label">Email atau Username</label>
        <input
          id="identifier"
          v-model="identifier"
          type="text"
          autocomplete="username"
          inputmode="email"
          required
          placeholder="nama@perusahaan.co.id atau username"
          class="input"
        />
      </div>

      <div>
        <label for="password" class="label">Kata Sandi</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          placeholder="••••••••"
          class="input"
        />
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="btn-primary w-full py-3 text-base shadow-sm"
      >
        <span v-if="isLoading" class="inline-flex items-center gap-2">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Memproses...
        </span>
        <span v-else>Masuk</span>
      </button>
    </form>
  </div>
</template>
