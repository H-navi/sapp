<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
    retryLabel?: string
    showRetry?: boolean
  }>(),
  {
    title: 'Gagal Memuat Data',
    message: 'Terjadi kendala saat menghubungkan ke server. Silakan periksa koneksi internet Anda dan coba lagi.',
    retryLabel: 'Coba Lagi',
    showRetry: true,
  }
)

const emit = defineEmits<{
  (e: 'retry'): void
}>()
</script>

<template>
  <div class="card p-6 text-center space-y-3 border-rose-200 bg-rose-50/40">
    <div class="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto" aria-hidden="true">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>

    <h3 class="text-sm font-bold text-rose-900">{{ title }}</h3>
    <p class="text-xs text-rose-700 max-w-sm mx-auto leading-relaxed">
      {{ message }}
    </p>

    <div v-if="showRetry" class="pt-2">
      <button
        type="button"
        class="btn bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold py-2 px-4 shadow-xs"
        @click="emit('retry')"
      >
        {{ retryLabel }}
      </button>
    </div>
  </div>
</template>
