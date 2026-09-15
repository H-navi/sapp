<script setup lang="ts">
import dayjs from 'dayjs'

const props = withDefaults(
  defineProps<{
    dueAt?: string | Date | null
    remainingText?: string | null
    isOverdue?: boolean
  }>(),
  {
    isOverdue: false,
  }
)

const { t } = useI18n()

const formattedDue = computed(() => {
  if (!props.dueAt) return '-'
  return dayjs(props.dueAt).format('D MMM YYYY, HH:mm')
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 text-xs tabular-nums font-medium"
    :class="isOverdue ? 'text-rose-700 font-semibold' : 'text-amber-800'"
    :title="`${t('approval.slaDeadline')}: ${formattedDue}`"
  >
    <span aria-hidden="true">{{ isOverdue ? '⚠️' : '⏳' }}</span>
    <span>{{ remainingText || (isOverdue ? t('approval.breachedHours', { hours: '' }).trim() : `${t('approval.slaDeadline')} ${formattedDue}`) }}</span>
  </span>
</template>
