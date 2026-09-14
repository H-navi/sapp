<script setup lang="ts">
export interface RuleCheckItem {
  id?: string | number
  ruleCode: string
  ruleType?: string
  passed: boolean
  message: string
  actualValue?: any
  thresholdValue?: any
}

defineProps<{
  rules: RuleCheckItem[]
}>()
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(r, idx) in rules"
      :key="r.id || idx"
      class="flex items-start gap-3 p-3 rounded-xl border text-xs transition-colors"
      :class="r.passed ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-rose-50/70 border-rose-200 text-rose-900'"
    >
      <div class="mt-0.5 shrink-0" aria-hidden="true">
        <svg
          v-if="r.passed"
          class="w-4 h-4 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <svg
          v-else
          class="w-4 h-4 text-rose-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <p class="font-semibold text-slate-900 leading-snug">{{ r.message }}</p>
          <span class="font-mono text-[10px] opacity-75 uppercase">{{ r.ruleCode }}</span>
        </div>

        <div v-if="r.actualValue !== undefined" class="mt-1 text-[11px] opacity-80 tabular-nums">
          Nilai aktual: <strong>{{ r.actualValue }}</strong>
          <span v-if="r.thresholdValue !== undefined"> (Batas: {{ r.thresholdValue }})</span>
        </div>
      </div>
    </div>
  </div>
</template>
