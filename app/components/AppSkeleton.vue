<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    type?: 'card' | 'list' | 'detail' | 'table'
    count?: number
  }>(),
  {
    type: 'list',
    count: 3,
  }
)
</script>

<template>
  <div class="space-y-3 animate-pulse" role="status" aria-label="Memuat konten...">
    <!-- SKELETON CARD / LIST -->
    <template v-if="type === 'card' || type === 'list'">
      <div
        v-for="i in count"
        :key="i"
        class="card p-4 space-y-3"
      >
        <div class="flex items-center justify-between">
          <div class="h-4 bg-slate-200 rounded w-1/4"></div>
          <div class="h-4 bg-slate-200 rounded w-16"></div>
        </div>
        <div class="h-5 bg-slate-200 rounded w-3/5"></div>
        <div class="h-3 bg-slate-100 rounded w-2/5"></div>
      </div>
    </template>

    <!-- SKELETON DETAIL -->
    <template v-else-if="type === 'detail'">
      <div class="card p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="h-6 bg-slate-200 rounded w-24"></div>
          <div class="h-8 bg-slate-200 rounded w-16"></div>
        </div>
        <div class="h-7 bg-slate-200 rounded w-1/2"></div>
        <div class="h-4 bg-slate-100 rounded w-1/3"></div>
        <div class="grid grid-cols-2 gap-3 pt-3">
          <div class="h-12 bg-slate-100 rounded-xl"></div>
          <div class="h-12 bg-slate-100 rounded-xl"></div>
        </div>
        <div class="h-20 bg-slate-50 rounded-xl"></div>
      </div>
    </template>

    <!-- SKELETON TABLE -->
    <template v-else-if="type === 'table'">
      <div class="card p-4 space-y-3">
        <div class="h-5 bg-slate-200 rounded w-1/3"></div>
        <div class="divide-y divide-slate-100">
          <div v-for="i in count" :key="i" class="py-3 flex items-center justify-between gap-4">
            <div class="h-4 bg-slate-100 rounded w-1/4"></div>
            <div class="h-4 bg-slate-100 rounded w-1/4"></div>
            <div class="h-4 bg-slate-100 rounded w-1/6"></div>
          </div>
        </div>
      </div>
    </template>
    <span class="sr-only">Memuat konten...</span>
  </div>
</template>
