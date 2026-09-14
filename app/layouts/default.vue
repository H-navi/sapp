<script setup lang="ts">
const route = useRoute()
const tabs = [
  { to: '/',           label: 'Beranda',   icon: 'i-home' },
  { to: '/pengajuan',  label: 'Pengajuan', icon: 'i-doc' },
  { to: '/approval',   label: 'Approval',  icon: 'i-check' },
  { to: '/profil',     label: 'Profil',    icon: 'i-user' },
]
const isActive = (to: string) => to === '/' ? route.path === '/' : route.path.startsWith(to)
</script>

<template>
  <div class="min-h-dvh pb-20 md:pb-0">
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <NuxtLink to="/" class="font-semibold text-slate-900">Perizinan Pegawai</NuxtLink>
        <slot name="header-action" />
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-4">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navigasi utama"
    >
      <ul class="mx-auto grid max-w-3xl grid-cols-4">
        <li v-for="tab in tabs" :key="tab.to">
          <NuxtLink
            :to="tab.to"
            class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs"
            :class="isActive(tab.to) ? 'text-brand-600 font-medium' : 'text-slate-500'"
          >
            <span class="text-lg" aria-hidden="true">•</span>
            {{ tab.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
