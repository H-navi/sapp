<script setup lang="ts">
const route = useRoute()
const { user } = useAuth()
const { t } = useI18n()

const isAdmin = computed(() => {
  return user.value?.roles?.includes('ADMIN') || user.value?.roles?.includes('HR_APPROVER')
})

const tabs = computed(() => {
  const list = [
    {
      label: t('nav.home'),
      to: '/',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      label: t('nav.requests'),
      to: '/pengajuan',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      label: t('nav.approval'),
      to: '/approval',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    },
    {
      label: t('nav.profile'),
      to: '/profil',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
  ]

  if (isAdmin.value) {
    list.splice(3, 0, {
      label: t('nav.admin'),
      to: '/admin',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    })
  }

  return list
})

function isActiveTab(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <nav
    aria-label="Navigasi Bawah"
    class="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-slate-200/90 shadow-lg pb-[max(6px,env(safe-area-inset-bottom))]"
  >
    <div class="grid grid-flow-col auto-cols-fr h-14 items-center">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 text-center transition-colors"
        :class="isActiveTab(tab.to) ? 'text-blue-700 font-semibold' : 'text-slate-500 hover:text-slate-800'"
      >
        <svg
          class="w-5 h-5 mb-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" :d="tab.icon" />
        </svg>
        <span class="text-[10px] leading-3">{{ tab.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
