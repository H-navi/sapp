<script setup lang="ts">
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import {
  type TimelineEntry,
  TIMELINE_ACTIONS,
  formatTimelineTitle,
} from '~~/shared/timeline-labels'

const props = defineProps<{
  entries: TimelineEntry[]
  loading?: boolean
}>()

const isExpanded = ref(false)

// Jika riwayat lebih dari 15 entri, tampilkan 5 terbaru kecuali jika pengguna menekan tombol buka
const displayedEntries = computed(() => {
  if (props.entries.length <= 15 || isExpanded.value) {
    return props.entries
  }
  // 5 entri paling akhir (terbaru)
  return props.entries.slice(-5)
})

const hiddenCount = computed(() => {
  if (props.entries.length <= 15) return 0
  return props.entries.length - 5
})

function getRelativeTime(d: string | Date): string {
  const diff = Date.now() - new Date(d).getTime()
  if (diff < 0) return 'Baru saja'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  return dayjs(d).format('D MMM YYYY')
}

function getAbsoluteTime(d: string | Date): string {
  return dayjs(d).format('D MMMM YYYY, HH:mm [WIB]')
}

function getActionDef(action: string) {
  return TIMELINE_ACTIONS[action] || {
    code: action,
    defaultLabel: action,
    color: 'slate',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    dotColor: 'bg-slate-400',
    isSystem: false,
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
    <div class="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
      <div>
        <h3 class="text-base font-semibold text-slate-900 flex items-center gap-2">
          <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Lini Masa Riwayat Persetujuan
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">Jejak lengkap perjalanan pengajuan dari awal hingga akhir</p>
      </div>
      <span class="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
        {{ entries.length }} Catatan
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="py-10 text-center text-slate-400 text-sm">
      <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      Memuat lini masa...
    </div>

    <!-- Empty State -->
    <div v-else-if="entries.length === 0" class="py-8 text-center text-slate-400 text-sm">
      Belum ada riwayat aktivitas untuk pengajuan ini.
    </div>

    <!-- Timeline List -->
    <div v-else class="relative">
      <!-- Tombol Expand Jika Lebih dari 15 entri dan belum dibuka -->
      <div v-if="hiddenCount > 0 && !isExpanded" class="mb-4 text-center">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          @click="isExpanded = true"
        >
          <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
          Tampilkan {{ hiddenCount }} riwayat terdahulu
        </button>
      </div>

      <!-- Timeline Items -->
      <div class="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        <div
          v-for="entry in displayedEntries"
          :key="entry.id"
          class="relative group"
        >
          <!-- Dot Indicator -->
          <div
            class="absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-white ring-2 ring-slate-100 shadow-sm flex items-center justify-center transition-transform group-hover:scale-110"
            :class="getActionDef(entry.action).dotColor"
          ></div>

          <!-- Entry Card / Content -->
          <div
            class="p-3.5 rounded-xl border transition-all"
            :class="[
              entry.actorType === 'SYSTEM' || getActionDef(entry.action).isSystem
                ? 'bg-purple-50/40 border-purple-100 hover:bg-purple-50/70'
                : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
            ]"
          >
            <!-- Header: Title & Relative Time -->
            <div class="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div class="flex items-center gap-2 flex-wrap">
                <!-- System vs Human Badge -->
                <span
                  v-if="entry.actorType === 'SYSTEM' || getActionDef(entry.action).isSystem"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider"
                >
                  Sistem
                </span>
                <span
                  v-else-if="entry.actorType === 'ADMIN'"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider"
                >
                  Admin
                </span>

                <!-- Action Title -->
                <h4 class="text-sm font-semibold text-slate-800">
                  {{ formatTimelineTitle(entry) }}
                </h4>
              </div>

              <!-- Time display with Tooltip -->
              <span
                class="text-xs text-slate-400 whitespace-nowrap cursor-help hover:text-slate-600 transition"
                :title="getAbsoluteTime(entry.createdAt)"
              >
                {{ getRelativeTime(entry.createdAt) }}
              </span>
            </div>

            <!-- Actor & Subtitle Details -->
            <div class="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span v-if="entry.actorName && entry.actorType !== 'SYSTEM'" class="font-medium text-slate-700">
                {{ entry.actorName }}
                <span v-if="entry.actorPosition" class="text-slate-400 font-normal">({{ entry.actorPosition }})</span>
              </span>
              <span class="text-slate-300">•</span>
              <span class="text-slate-400 text-[11px]">{{ getAbsoluteTime(entry.createdAt) }}</span>
            </div>

            <!-- Notes or Reasons (Always visible as blockquote, critical for user understanding) -->
            <blockquote
              v-if="entry.reason || entry.note"
              class="mt-2.5 text-xs rounded-lg p-3 italic border-l-3"
              :class="[
                entry.action === 'REJECTED' || entry.action === 'AUTO_REJECTED'
                  ? 'bg-rose-50 text-rose-800 border-rose-400'
                  : entry.action === 'ADMIN_OVERRIDE' || entry.action === 'REASSIGNED'
                  ? 'bg-amber-50 text-amber-800 border-amber-400'
                  : 'bg-slate-50 text-slate-700 border-slate-300'
              ]"
            >
              <div class="font-sans font-semibold not-italic text-[11px] mb-0.5" :class="entry.action === 'REJECTED' ? 'text-rose-900' : 'text-slate-800'">
                {{ entry.reason ? 'Alasan:' : 'Catatan:' }}
              </div>
              "{{ entry.reason || entry.note }}"
            </blockquote>
          </div>
        </div>
      </div>

      <!-- Tombol Collapse Kembali Jika Sudah Dibuka -->
      <div v-if="hiddenCount > 0 && isExpanded" class="mt-4 text-center">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          @click="isExpanded = false"
        >
          <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
          Sembunyikan {{ hiddenCount }} riwayat terdahulu
        </button>
      </div>
    </div>
  </div>
</template>
