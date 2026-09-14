<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  {
    placeholder: 'Cari...',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search', value: string): void
}>()

let timeout: ReturnType<typeof setTimeout> | null = null

function handleInput(event: Event) {
  const val = (event.target as HTMLInputElement).value
  emit('update:modelValue', val)
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(() => {
    emit('search', val)
  }, 300)
}
</script>

<template>
  <div class="relative w-full">
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <input
      type="search"
      :value="modelValue"
      :placeholder="placeholder"
      class="input pl-10"
      @input="handleInput"
    />
  </div>
</template>
