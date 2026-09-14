import { randomBytes } from 'node:crypto'

export interface TelegramTokenData {
  userId: string
  employeeId?: string | null
  expiresAt: number
}

// Global in-memory token store untuk penautan Telegram (tahan terhadap HMR reload, berlaku 15 menit)
const getLinkingStore = (): Map<string, TelegramTokenData> => {
  const g = globalThis as any
  if (!g.__telegramLinkingStore) {
    g.__telegramLinkingStore = new Map<string, TelegramTokenData>()
  }
  return g.__telegramLinkingStore
}

export function createTelegramLinkingToken(userId: string, employeeId?: string | null): string {
  const token = randomBytes(12).toString('hex')
  const expiresAt = Date.now() + 15 * 60 * 1000 // 15 menit
  const store = getLinkingStore()

  store.set(token, { userId, employeeId, expiresAt })

  // Bersihkan token yang sudah lewat waktu kadaluarsa
  const now = Date.now()
  for (const [k, v] of store.entries()) {
    if (v.expiresAt < now) {
      store.delete(k)
    }
  }

  return token
}

export function verifyTelegramLinkingToken(token: string): { userId: string; employeeId?: string | null } | null {
  const store = getLinkingStore()
  const data = store.get(token)
  if (!data) return null

  if (data.expiresAt < Date.now()) {
    store.delete(token)
    return null
  }

  // Token sekali pakai: hapus setelah diverifikasi
  store.delete(token)
  return {
    userId: data.userId,
    employeeId: data.employeeId,
  }
}
