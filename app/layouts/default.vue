<script setup lang="ts">
const route = useRoute()
const { user, can, hasRole, logout } = useAuth()
const { t } = useI18n()

const allTabs = computed(() => {
  const list = [
    { to: '/', label: t('nav.home'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/pengajuan', label: t('nav.requests'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ]
  if (can('approval.view') || can('approval.act')) {
    list.push({ to: '/approval', label: t('nav.approval'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' })
  }
  if (hasRole('ADMIN')) {
    list.push({ to: '/admin', label: t('nav.admin'), icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' })
  }
  list.push({ to: '/profil', label: t('nav.profile'), icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' })
  return list
})

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

const userInitials = computed(() => {
  const name = user.value?.fullName || user.value?.username || 'User'
  return name
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})
</script>

<template>
  <div class="min-h-dvh bg-slate-50 text-slate-800 antialiased pb-20 md:pb-8 flex flex-col">
    <!-- Header Desktop & Mobile -->
    <header class="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur shadow-xs">
      <div class="mx-auto flex h-16 max-w-6xl 2xl:max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <!-- Logo & Brand -->
        <NuxtLink to="/" class="flex items-center gap-2.5 group">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs group-hover:bg-brand-700 transition">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <span class="font-bold tracking-tight text-slate-900 text-base block leading-none">AutoLeave</span>
            <span class="text-[10px] text-slate-400 font-medium tracking-wide">{{ t('nav.brandSubtitle') }}</span>
          </div>
        </NuxtLink>

        <!-- Navigasi Desktop -->
        <nav class="hidden md:flex items-center gap-1">
          <NuxtLink
            v-for="tab in allTabs"
            :key="tab.to"
            :to="tab.to"
            class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            :class="isActive(tab.to) ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'"
          >
            <svg class="h-4 w-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
            </svg>
            {{ tab.label }}
          </NuxtLink>
        </nav>

        <!-- Info Pengguna & Switcher & Logout (Desktop & Mobile) -->
        <div class="flex items-center gap-2 sm:gap-3">
          <slot name="header-action" />

          <!-- Language Switcher -->
          <AppLanguageSwitcher variant="compact" />

          <div v-if="user" class="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <NuxtLink to="/profil" class="flex items-center gap-2 hover:opacity-80 transition">
              <div class="h-8 w-8 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center border border-brand-200/80">
                {{ userInitials }}
              </div>
              <div class="text-left leading-tight hidden lg:block">
                <p class="text-xs font-bold text-slate-900 truncate max-w-[130px]">{{ user.fullName || user.username }}</p>
                <p class="text-[10px] text-slate-400 uppercase font-mono">{{ user.roles[0] || 'PEGAWAI' }}</p>
              </div>
            </NuxtLink>

            <button
              type="button"
              class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              :title="t('nav.logout')"
              @click="logout"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Konten Halaman Utama -->
    <main class="mx-auto w-full max-w-6xl 2xl:max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex-1">
      <slot />
    </main>

    <!-- Navigasi Mobile (Bottom Bar) -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden shadow-lg"
      aria-label="Navigasi utama"
    >
      <ul
        class="mx-auto grid max-w-lg"
        :style="{ gridTemplateColumns: `repeat(${allTabs.length}, minmax(0, 1fr))` }"
      >
        <li v-for="tab in allTabs" :key="tab.to">
          <NuxtLink
            :to="tab.to"
            class="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors"
            :class="isActive(tab.to) ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="tab.icon" />
            </svg>
            <span>{{ tab.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- Global Floating Toast Feedback -->
    <AppToast />
  </div>
</template>
