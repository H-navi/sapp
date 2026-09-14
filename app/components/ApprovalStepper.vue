<script setup lang="ts">
import dayjs from 'dayjs'

export interface StepAssignee {
  employeeId?: string
  fullName: string
  nip?: string
  positionName?: string
  response?: 'APPROVED' | 'REJECTED' | 'SKIPPED' | null
  respondedAt?: string | null
  responseNote?: string | null
  isDelegate?: boolean
}

export interface ApprovalStepItem {
  id: string
  stepOrder: number
  stepName: string
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' | 'ESCALATED' | string
  startedAt?: string | null
  dueAt?: string | null
  decidedAt?: string | null
  assignees?: StepAssignee[]
  remainingTimeText?: string
  isOverdue?: boolean
}

const props = defineProps<{
  steps: ApprovalStepItem[]
}>()

function formatDateTime(val?: string | null) {
  if (!val) return '-'
  return dayjs(val).format('D MMM YYYY, HH:mm')
}

function getAssigneeNames(assignees?: StepAssignee[]) {
  if (!assignees || assignees.length === 0) return '—'
  return assignees.map(a => a.fullName + (a.isDelegate ? ' (Delegasi)' : '')).join(', ')
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 mb-6">
    <div class="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
      <div>
        <h3 class="text-base font-semibold text-slate-900 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
          Ringkasan Tahapan Persetujuan
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">Posisi tahapan dan status approver saat ini</p>
      </div>
      <span class="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
        {{ steps.length }} Tahap
      </span>
    </div>

    <!-- Stepper List -->
    <div class="relative">
      <div
        v-for="(step, idx) in steps"
        :key="step.id"
        class="relative flex items-start gap-4 pb-6 last:pb-1"
      >
        <!-- Connector Line -->
        <div
          v-if="idx < steps.length - 1"
          class="absolute left-4 top-8 -bottom-1 w-0.5 -ml-px transition-colors duration-200"
          :class="{
            'bg-emerald-400': step.status === 'APPROVED',
            'bg-rose-400': step.status === 'REJECTED',
            'bg-slate-200': step.status !== 'APPROVED' && step.status !== 'REJECTED'
          }"
        ></div>

        <!-- Step Icon / Indicator -->
        <div class="relative z-10 flex items-center justify-center">
          <!-- APPROVED -->
          <div
            v-if="step.status === 'APPROVED'"
            class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white"
            title="Disetujui"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <!-- REJECTED -->
          <div
            v-else-if="step.status === 'REJECTED'"
            class="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white"
            title="Ditolak"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <!-- PENDING -->
          <div
            v-else-if="step.status === 'PENDING'"
            class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-xs shadow-sm ring-4 ring-blue-100 animate-pulse"
            title="Sedang Menunggu Keputusan"
          >
            <span class="w-2.5 h-2.5 rounded-full bg-white"></span>
          </div>

          <!-- ESCALATED -->
          <div
            v-else-if="step.status === 'ESCALATED'"
            class="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs shadow-sm ring-4 ring-white"
            title="Batas waktu terlewati, dieskalasi"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <!-- SKIPPED -->
          <div
            v-else-if="step.status === 'SKIPPED'"
            class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shadow-sm ring-4 ring-white"
            title="Tahap dilewati sesuai aturan"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </div>

          <!-- WAITING -->
          <div
            v-else
            class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-medium text-xs shadow-sm ring-4 ring-white border border-slate-200"
            title="Belum Dimulai"
          >
            {{ step.stepOrder }}
          </div>
        </div>

        <!-- Step Content -->
        <div class="flex-1 min-w-0 pt-0.5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-sm font-semibold text-slate-800">
                  {{ step.stepName }}
                </h4>

                <!-- Status Badge -->
                <span
                  v-if="step.status === 'APPROVED'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  Disetujui
                </span>
                <span
                  v-else-if="step.status === 'REJECTED'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200"
                >
                  Ditolak
                </span>
                <span
                  v-else-if="step.status === 'PENDING'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
                >
                  Menunggu Keputusan
                </span>
                <span
                  v-else-if="step.status === 'ESCALATED'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200"
                >
                  Dieskalasi
                </span>
                <span
                  v-else-if="step.status === 'SKIPPED'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                >
                  Dilewati
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200"
                >
                  Belum Mulai
                </span>
              </div>

              <!-- Assignee Name -->
              <p class="text-xs text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                <span class="font-medium text-slate-700">Approver:</span>
                <span>{{ getAssigneeNames(step.assignees) }}</span>
              </p>
            </div>

            <!-- Time / SLA Countdown Info -->
            <div class="text-left sm:text-right text-xs mt-1 sm:mt-0">
              <div v-if="step.status === 'APPROVED' && step.decidedAt" class="text-emerald-700 font-medium">
                {{ formatDateTime(step.decidedAt) }}
              </div>
              <div v-else-if="step.status === 'REJECTED' && step.decidedAt" class="text-rose-700 font-medium">
                {{ formatDateTime(step.decidedAt) }}
              </div>
              <div v-else-if="step.status === 'PENDING'">
                <div v-if="step.dueAt" class="text-slate-500 text-[11px]">
                  Batas: {{ formatDateTime(step.dueAt) }}
                </div>
                <div
                  v-if="step.remainingTimeText"
                  class="font-medium mt-0.5"
                  :class="step.isOverdue ? 'text-rose-600 font-semibold' : 'text-blue-600'"
                >
                  ⏳ {{ step.remainingTimeText }}
                </div>
              </div>
              <div v-else-if="step.status === 'WAITING'" class="text-slate-400">
                —
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
