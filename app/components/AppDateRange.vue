<script setup lang="ts">
import dayjs from 'dayjs'

const props = withDefaults(
  defineProps<{
    startDate?: string
    endDate?: string
    minDate?: string
    maxDate?: string
    workingDays?: number | string | null
    totalDays?: number | string | null
    disabled?: boolean
  }>(),
  {
    startDate: '',
    endDate: '',
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
}>()

function onStartChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:startDate', val)
  if (props.endDate && val > props.endDate) {
    emit('update:endDate', val)
  }
}

function onEndChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:endDate', val)
}

const computedCalendarDays = computed(() => {
  if (!props.startDate || !props.endDate) return null
  const s = dayjs(props.startDate)
  const e = dayjs(props.endDate)
  if (!s.isValid() || !e.isValid() || e.isBefore(s)) return null
  return e.diff(s, 'day') + 1
})
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <!-- Tanggal Mulai -->
      <div>
        <label for="input-start-date" class="label text-xs">
          Tanggal Mulai <span class="text-rose-600">*</span>
        </label>
        <input
          id="input-start-date"
          type="date"
          :value="startDate"
          :min="minDate"
          :max="maxDate"
          :disabled="disabled"
          class="input"
          @change="onStartChange"
        />
      </div>

      <!-- Tanggal Selesai -->
      <div>
        <label for="input-end-date" class="label text-xs">
          Tanggal Selesai <span class="text-rose-600">*</span>
        </label>
        <input
          id="input-end-date"
          type="date"
          :value="endDate"
          :min="startDate || minDate"
          :max="maxDate"
          :disabled="disabled"
          class="input"
          @change="onEndChange"
        />
      </div>
    </div>

    <!-- Ringkasan Durasi Langsung -->
    <div
      v-if="startDate && endDate"
      class="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs"
    >
      <div class="flex items-center gap-1.5 text-blue-950">
        <span aria-hidden="true">📅</span>
        <span>Durasi terhitung:</span>
      </div>

      <div class="font-bold text-blue-900 tabular-nums">
        <span v-if="workingDays !== undefined && workingDays !== null">{{ workingDays }} hari kerja</span>
        <span v-else-if="computedCalendarDays">{{ computedCalendarDays }} hari kalender</span>
      </div>
    </div>
  </div>
</template>
