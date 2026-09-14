<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name: string
    color?: string | null
    code?: string | null
    size?: 'sm' | 'md'
  }>(),
  {
    color: '#3b82f6',
    size: 'md',
  }
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-lg font-medium text-slate-800"
    :class="size === 'sm' ? 'text-xs' : 'text-sm'"
  >
    <span
      class="rounded-full shrink-0"
      :style="{ backgroundColor: color || '#3b82f6' }"
      :class="size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'"
      aria-hidden="true"
    ></span>
    <span>{{ name }}</span>
    <span v-if="code" class="text-xs text-slate-400 font-mono">({{ code }})</span>
  </span>
</template>
