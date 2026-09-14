<script setup lang="ts">
export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_APPROVED'
  | 'AUTO_REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'WAITING'
  | 'PENDING'
  | 'SKIPPED'
  | 'ESCALATED'
  | string

const props = withDefaults(
  defineProps<{
    status?: RequestStatus | null
    size?: 'sm' | 'md'
    dot?: boolean
  }>(),
  {
    status: 'DRAFT',
    size: 'md',
    dot: true,
  }
)

interface BadgeConfig {
  label: string
  dotClass: string
  badgeClass: string
}

const config = computed<BadgeConfig>(() => {
  const s = String(props.status || 'DRAFT').toUpperCase()
  switch (s) {
    case 'DRAFT':
      return {
        label: 'Draf',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      }
    case 'SUBMITTED':
      return {
        label: 'Diajukan',
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      }
    case 'IN_REVIEW':
      return {
        label: 'Sedang Direviu',
        dotClass: 'bg-blue-600',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      }
    case 'APPROVED':
      return {
        label: 'Disetujui',
        dotClass: 'bg-emerald-600',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      }
    case 'REJECTED':
      return {
        label: 'Ditolak',
        dotClass: 'bg-rose-600',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      }
    case 'AUTO_APPROVED':
      return {
        label: 'Disetujui Otomatis',
        dotClass: 'bg-purple-600',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
      }
    case 'AUTO_REJECTED':
      return {
        label: 'Ditolak Otomatis',
        dotClass: 'bg-purple-600',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
      }
    case 'CANCELLED':
      return {
        label: 'Dibatalkan',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      }
    case 'EXPIRED':
      return {
        label: 'Kedaluwarsa',
        dotClass: 'bg-slate-500',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      }
    case 'WAITING':
      return {
        label: 'Belum Mulai',
        dotClass: 'bg-slate-300',
        badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
      }
    case 'PENDING':
      return {
        label: 'Menunggu',
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      }
    case 'SKIPPED':
      return {
        label: 'Dilewati',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
      }
    case 'ESCALATED':
      return {
        label: 'Dieskalasi',
        dotClass: 'bg-orange-500',
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
      }
    default:
      return {
        label: props.status || '-',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      }
  }
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors"
    :class="[
      config.badgeClass,
      size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-xs leading-4'
    ]"
  >
    <span
      v-if="dot"
      class="rounded-full shrink-0"
      :class="[
        config.dotClass,
        size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
      ]"
      aria-hidden="true"
    ></span>
    <span>{{ config.label }}</span>
  </span>
</template>
