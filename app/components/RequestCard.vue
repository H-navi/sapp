<script setup lang="ts">
import dayjs from 'dayjs'

export interface RequestItem {
  id: string
  requestNumber: string
  leaveType?: {
    name: string
    color?: string | null
    code?: string | null
  }
  employee?: {
    fullName: string
    nip?: string
    departmentName?: string
  }
  startDate: string
  endDate: string
  workingDays: number | string
  totalDays?: number | string
  status: string
  currentStepName?: string | null
}

const props = withDefaults(
  defineProps<{
    request: RequestItem
    to?: string
    showRequester?: boolean
  }>(),
  {
    showRequester: false,
  }
)

function formatDateRange(start: string, end: string) {
  const s = dayjs(start).format('D MMM YYYY')
  const e = dayjs(end).format('D MMM YYYY')
  if (s === e) return s
  return `${s} – ${e}`
}
</script>

<template>
  <NuxtLink
    :to="to || `/pengajuan/${request.id}`"
    class="card block transition-all hover:border-slate-300 hover:shadow-xs active:scale-[0.99] p-4 text-left"
  >
    <!-- Top Bar: Status Badge & Request Number -->
    <div class="flex items-center justify-between gap-2 mb-2.5">
      <div class="flex items-center gap-2">
        <StatusBadge :status="request.status" size="sm" />
        <span class="text-xs font-mono text-slate-400">#{{ request.requestNumber }}</span>
      </div>

      <div class="text-xs font-semibold text-blue-700 tabular-nums">
        {{ request.workingDays }} hari kerja
      </div>
    </div>

    <!-- Main: Leave Type & Requester -->
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <LeaveTypeChip
          :name="request.leaveType?.name || 'Izin'"
          :color="request.leaveType?.color"
        />
      </div>

      <div v-if="showRequester && request.employee" class="text-xs text-slate-600">
        <span class="font-medium text-slate-800">{{ request.employee.fullName }}</span>
        <span v-if="request.employee.departmentName" class="text-slate-400"> · {{ request.employee.departmentName }}</span>
      </div>
    </div>

    <!-- Bottom Info: Date range & Active Step -->
    <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <div>
        {{ formatDateRange(request.startDate, request.endDate) }}
      </div>

      <div v-if="request.currentStepName" class="text-[11px] text-slate-600 font-medium">
        Tahap: {{ request.currentStepName }}
      </div>
    </div>
  </NuxtLink>
</template>
