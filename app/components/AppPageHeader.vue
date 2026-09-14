<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="sticky top-14 z-20 -mx-4 -mt-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:p-0">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-bold text-slate-900 sm:text-xl">{{ title }}</h1>
        <p v-if="subtitle" class="text-xs text-slate-500">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
