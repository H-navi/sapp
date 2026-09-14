<script setup lang="ts">
const route = useRoute()
const { can, hasRole } = useAuth()

const allTabs = computed(() => {
  const list = [
    { to: '/', label: 'Beranda' },
    { to: '/pengajuan', label: 'Pengajuan' },
  ]
  if (can('approval.view') || can('approval.act')) {
    list.push({ to: '/approval', label: 'Approval' })
  }
  if (hasRole('ADMIN')) {
    list.push({ to: '/admin', label: 'Admin' })
  }
  list.push({ to: '/profil', label: 'Profil' })
  return list
})

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <div class="min-h-dvh pb-20 md:pb-0">
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <NuxtLink to="/" class="font-semibold text-slate-900">Perizinan Pegawai</NuxtLink>
        <div class="flex items-center gap-3">
          <slot name="header-action" />
          <nav class="hidden md:flex items-center gap-4 text-sm font-medium">
            <NuxtLink
              v-for="tab in allTabs"
              :key="tab.to"
              :to="tab.to"
              :class="isActive(tab.to) ? 'text-brand-600 font-semibold' : 'text-slate-600 hover:text-slate-900'"
            >
              {{ tab.label }}
            </NuxtLink>
          </nav>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-4">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navigasi utama"
    >
      <ul
        class="mx-auto grid max-w-3xl"
        :style="{ gridTemplateColumns: `repeat(${allTabs.length}, minmax(0, 1fr))` }"
      >
        <li v-for="tab in allTabs" :key="tab.to">
          <NuxtLink
            :to="tab.to"
            class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs"
            :class="isActive(tab.to) ? 'text-brand-600 font-semibold' : 'text-slate-500'"
          >
            <span class="text-lg leading-none" aria-hidden="true">•</span>
            <span>{{ tab.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
