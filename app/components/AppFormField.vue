<script setup lang="ts">
defineProps<{
  label: string
  forId?: string
  required?: boolean
  error?: string
  hint?: string
}>()
</script>

<template>
  <div class="space-y-1">
    <div class="flex items-center justify-between">
      <label :for="forId" class="label mb-0">
        {{ label }}
        <span v-if="required" class="text-red-500">*</span>
      </label>
      <span v-if="hint" class="text-xs text-slate-400">{{ hint }}</span>
    </div>
    <slot />
    <p v-if="error" class="text-xs text-red-600 font-medium">{{ error }}</p>
  </div>
</template>
