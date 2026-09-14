<script setup lang="ts">
// Wadah sticky aksi di bagian bawah layar (thumb zone)
</script>

<template>
  <div
    class="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-3 shadow-lg pb-[max(12px,env(safe-area-inset-bottom))]"
  >
    <div class="mx-auto max-w-3xl flex items-center gap-3">
      <slot />
    </div>
  </div>
</template>
