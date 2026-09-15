import { id } from '~/locales/id'
import { en } from '~/locales/en'
import type { LocaleDictionary } from '~/locales/types'

export type AppLocale = 'id' | 'en'

const dictionaries: Record<AppLocale, LocaleDictionary> = {
  id,
  en,
}

export function useI18n() {
  const cookieLocale = useCookie<AppLocale>('app_locale', {
    default: () => 'id',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })

  const locale = useState<AppLocale>('app:locale', () => cookieLocale.value || 'id')

  // Pastikan atribut <html lang="..."> tersinkronisasi
  useHead({
    htmlAttrs: {
      lang: computed(() => locale.value),
    },
  })

  function setLocale(newLocale: AppLocale) {
    locale.value = newLocale
    cookieLocale.value = newLocale
  }

  function t(path: string, params?: Record<string, string | number>): string {
    const keys = path.split('.')
    let current: any = dictionaries[locale.value]

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        // Fallback ke Bahasa Indonesia jika tidak ditemukan
        let fallback: any = dictionaries.id
        for (const fbKey of keys) {
          if (fallback && typeof fallback === 'object' && fbKey in fallback) {
            fallback = fallback[fbKey]
          } else {
            fallback = undefined
            break
          }
        }
        current = fallback !== undefined ? fallback : path
        break
      }
    }

    if (typeof current !== 'string') {
      return path
    }

    let result = current
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }

    return result
  }

  function formatDate(
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
  ): string {
    if (!value) return '-'
    const date = typeof value === 'string' ? new Date(value) : value
    if (isNaN(date.getTime())) return '-'
    const code = locale.value === 'id' ? 'id-ID' : 'en-US'
    return new Intl.DateTimeFormat(code, options).format(date)
  }

  function formatNumber(
    value: number | null | undefined,
    options?: Intl.NumberFormatOptions
  ): string {
    if (value === null || value === undefined || isNaN(value)) return '0'
    const code = locale.value === 'id' ? 'id-ID' : 'en-US'
    return new Intl.NumberFormat(code, options).format(value)
  }

  return {
    locale,
    setLocale,
    t,
    formatDate,
    formatNumber,
  }
}
