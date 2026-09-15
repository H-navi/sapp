<script setup lang="ts">
import type { AppLocale } from '~/composables/useI18n'

const props = withDefaults(
  defineProps<{
    variant?: 'compact' | 'card'
  }>(),
  {
    variant: 'compact',
  }
)

const { locale, setLocale, t } = useI18n()

function chooseLocale(newLoc: AppLocale) {
  if (locale.value !== newLoc) {
    setLocale(newLoc)
  }
}
</script>

<template>
  <!-- Variant Compact (Header & Navbar) -->
  <div
    v-if="variant === 'compact'"
    class="inline-flex items-center rounded-xl bg-slate-100/90 p-0.5 border border-slate-200/80 shadow-2xs"
    role="group"
    :aria-label="t('profile.selectLanguage')"
  >
    <button
      type="button"
      class="relative flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all min-h-[32px] select-none"
      :class="
        locale === 'id'
          ? 'bg-white text-brand-700 shadow-xs ring-1 ring-slate-900/5'
          : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
      "
      :title="t('profile.indonesian')"
      @click="chooseLocale('id')"
    >
      <span class="text-sm leading-none" aria-hidden="true">🇮🇩</span>
      <span>ID</span>
    </button>
    <button
      type="button"
      class="relative flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all min-h-[32px] select-none"
      :class="
        locale === 'en'
          ? 'bg-white text-brand-700 shadow-xs ring-1 ring-slate-900/5'
          : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
      "
      :title="t('profile.english')"
      @click="chooseLocale('en')"
    >
      <span class="text-sm leading-none" aria-hidden="true">🇬🇧</span>
      <span>EN</span>
    </button>
  </div>

  <!-- Variant Card (Form Pengaturan Profil) -->
  <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
    <button
      type="button"
      class="relative flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all group"
      :class="
        locale === 'id'
          ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-xs'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
      "
      @click="chooseLocale('id')"
    >
      <span class="text-2xl pt-0.5" aria-hidden="true">🇮🇩</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <p class="text-sm font-bold text-slate-900">{{ t('profile.indonesian') }}</p>
          <div
            v-if="locale === 'id'"
            class="h-5 w-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs"
          >
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <p class="text-xs text-slate-500 mt-0.5">Bahasa resmi Republik Indonesia</p>
      </div>
    </button>

    <button
      type="button"
      class="relative flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all group"
      :class="
        locale === 'en'
          ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-xs'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
      "
      @click="chooseLocale('en')"
    >
      <span class="text-2xl pt-0.5" aria-hidden="true">🇬🇧</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <p class="text-sm font-bold text-slate-900">{{ t('profile.english') }}</p>
          <div
            v-if="locale === 'en'"
            class="h-5 w-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs"
          >
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <p class="text-xs text-slate-500 mt-0.5">International English interface</p>
      </div>
    </button>
  </div>
</template>
