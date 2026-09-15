import { describe, it, expect } from 'vitest'
import { id } from '../../app/locales/id'
import { en } from '../../app/locales/en'

function extractKeys(obj: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(extractKeys(v, fullPath))
    } else {
      keys.push(fullPath)
    }
  }
  return keys.sort()
}

describe('i18n Dictionary Parity & Translations', () => {
  const idKeys = extractKeys(id)
  const enKeys = extractKeys(en)

  it('memastikan setiap kunci dalam kamus Indonesia (id) ada di kamus Inggris (en)', () => {
    const missingInEn = idKeys.filter((k) => !enKeys.includes(k))
    expect(missingInEn).toEqual([])
  })

  it('memastikan setiap kunci dalam kamus Inggris (en) ada di kamus Indonesia (id)', () => {
    const missingInId = enKeys.filter((k) => !idKeys.includes(k))
    expect(missingInId).toEqual([])
  })

  it('memastikan tidak ada nilai terjemahan kosong atau undefined', () => {
    for (const key of idKeys) {
      const val = key.split('.').reduce((acc: any, part) => acc?.[part], id)
      expect(typeof val).toBe('string')
      expect(val.trim().length).toBeGreaterThan(0)
    }
    for (const key of enKeys) {
      const val = key.split('.').reduce((acc: any, part) => acc?.[part], en)
      expect(typeof val).toBe('string')
      expect(val.trim().length).toBeGreaterThan(0)
    }
  })

  it('memastikan interpolasi placeholder parameter berfungsi pada string berparameter', () => {
    const idTemplate = id.approval.remainingHours
    expect(idTemplate).toContain('{hours}')
    const renderedId = idTemplate.replace('{hours}', '4.5')
    expect(renderedId).toBe('Sisa 4.5 jam kerja')

    const enTemplate = en.approval.remainingHours
    expect(enTemplate).toContain('{hours}')
    const renderedEn = enTemplate.replace('{hours}', '4.5')
    expect(renderedEn).toBe('4.5 working hours left')
  })
})
