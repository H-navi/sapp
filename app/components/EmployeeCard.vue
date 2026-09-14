<script setup lang="ts">
defineProps<{
  employee: {
    id: string
    nip: string
    fullName: string
    email: string
    phone?: string | null
    departmentName?: string | null
    positionName?: string | null
    positionLevel?: number | null
    employmentStatus: string
    isActive: boolean
    canSubmitRequest: boolean
  }
}>()
</script>

<template>
  <NuxtLink
    :to="`/admin/pegawai/${employee.id}`"
    class="card block hover:border-brand-400 hover:shadow-md transition-all active:scale-[0.99]"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3 min-w-0">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 text-sm">
          {{ employee.fullName.charAt(0).toUpperCase() }}
        </div>
        <div class="min-w-0">
          <h3 class="font-semibold text-slate-900 text-sm truncate">{{ employee.fullName }}</h3>
          <p class="text-xs text-slate-500 truncate">{{ employee.nip }} · {{ employee.email }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span v-if="employee.departmentName" class="badge bg-slate-100 text-slate-700">
              {{ employee.departmentName }}
            </span>
            <span v-if="employee.positionName" class="badge bg-blue-50 text-blue-700">
              {{ employee.positionName }}
            </span>
            <span class="badge bg-slate-100 text-slate-600">
              {{ employee.employmentStatus }}
            </span>
          </div>
        </div>
      </div>

      <div class="shrink-0 flex flex-col items-end gap-1.5">
        <span
          class="badge"
          :class="employee.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
        >
          {{ employee.isActive ? 'Aktif' : 'Nonaktif' }}
        </span>
        <span
          v-if="!employee.canSubmitRequest"
          class="badge bg-amber-50 text-amber-700 text-[10px]"
        >
          Izin Diblokir
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
