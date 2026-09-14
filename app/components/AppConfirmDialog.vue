<script setup lang="ts">
withDefaults(
  defineProps<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    isDanger?: boolean
    isLoading?: boolean
  }>(),
  {
    confirmText: 'Ya, Lanjutkan',
    cancelText: 'Batal',
    isDanger: false,
    isLoading: false,
  }
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('cancel')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>


<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" @click="emit('cancel')" />
      <div class="card relative z-10 w-full max-w-sm p-6 shadow-xl">
        <h3 class="text-base font-bold text-slate-900">{{ title }}</h3>
        <p class="mt-2 text-sm text-slate-600 leading-relaxed">{{ message }}</p>

        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="btn-ghost w-full sm:w-auto"
            :disabled="isLoading"
            @click="emit('cancel')"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            :class="isDanger ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'"
            class="w-full sm:w-auto"
            :disabled="isLoading"
            @click="emit('confirm')"
          >
            <span v-if="isLoading">Memproses...</span>
            <span v-else>{{ confirmText }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
