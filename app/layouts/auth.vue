<template>
  <div class="relative flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-8">
    <!-- Top Right Language Switcher -->
    <div class="absolute top-4 right-4 sm:top-6 sm:right-6">
      <AppLanguageSwitcher variant="compact" />
    </div>

    <div class="w-full max-w-sm">
      <slot />
    </div>
  </div>
</template>
