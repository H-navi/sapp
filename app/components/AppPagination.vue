<script setup lang="ts">
defineProps<{
  page: number
  totalPages: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'change', newPage: number): void
}>()
</script>

<template>
  <div class="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
    <span>Total <strong>{{ total }}</strong> data</span>
    <div class="flex items-center gap-2">
      <button
        type="button"
        :disabled="page <= 1"
        class="btn-ghost px-2.5 py-1 text-xs"
        @click="emit('change', page - 1)"
      >
        Sebelumnya
      </button>
      <span class="font-medium text-slate-700">{{ page }} / {{ totalPages || 1 }}</span>
      <button
        type="button"
        :disabled="page >= totalPages"
        class="btn-ghost px-2.5 py-1 text-xs"
        @click="emit('change', page + 1)"
      >
        Berikutnya
      </button>
    </div>
  </div>
</template>
