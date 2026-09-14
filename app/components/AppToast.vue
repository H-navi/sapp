<script setup lang="ts">
const { toasts, remove } = useToast()

function getToastStyle(type: string) {
  switch (type) {
    case 'success':
      return 'bg-emerald-900 text-white shadow-emerald-950/20'
    case 'error':
      return 'bg-rose-900 text-white shadow-rose-950/20'
    case 'warning':
      return 'bg-amber-900 text-white shadow-amber-950/20'
    default:
      return 'bg-slate-900 text-white shadow-slate-950/20'
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      aria-live="polite"
      class="fixed top-4 inset-x-0 z-50 pointer-events-none flex flex-col items-center gap-2 px-4"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0 scale-95"
        enter-to-class="transform translate-y-0 opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100 scale-100"
        leave-to-class="transform -translate-y-2 opacity-0 scale-95"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto max-w-sm w-full rounded-xl p-3.5 shadow-xl text-xs flex items-center justify-between gap-3"
          :class="getToastStyle(t.type)"
          role="alert"
        >
          <div class="flex items-center gap-2">
            <span v-if="t.type === 'success'" class="text-emerald-400 font-bold">✓</span>
            <span v-else-if="t.type === 'error'" class="text-rose-400 font-bold">✕</span>
            <span v-else-if="t.type === 'warning'" class="text-amber-400 font-bold">⚠️</span>
            <span v-else class="text-blue-400 font-bold">ℹ️</span>
            <span class="font-medium leading-relaxed">{{ t.message }}</span>
          </div>

          <button
            type="button"
            class="text-white/60 hover:text-white p-1 rounded transition min-h-[32px] min-w-[32px] inline-flex items-center justify-center"
            @click="remove(t.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
