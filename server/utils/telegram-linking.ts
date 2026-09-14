import { randomBytes } from 'node:crypto'

export interface TelegramTokenData {
  userId: string
  employeeId?: string | null
  expiresAt: number
}

// In-memory token store untuk penautan Telegram (berlaku 15 menit)
const linkingStore = new Map<string, TelegramTokenData>()

export function createTelegramLinkingToken(userId: string, employeeId?: string | null): string {
  const token = randomBytes(12).toString('hex')
  const expiresAt = Date.now() + 15 * 60 * 1000 // 15 menit

  linkingStore.set(token, { userId, employeeId, expiresAt })

  // Bersihkan token yang sudah lewat waktu kadaluarsa
  const now = Date.now()
  for (const [k, v] of linkingStore.entries()) {
    if (v.expiresAt < now) {
      linkingStore.delete(k)
    }
  }

  return token
}

export function verifyTelegramLinkingToken(token: string): { userId: string; employeeId?: string | null } | null {
  const data = linkingStore.get(token)
  if (!data) return null

  if (data.expiresAt < Date.now()) {
    linkingStore.delete(token)
    return null
  }

  // Token sekali pakai: hapus setelah diverifikasi
  linkingStore.delete(token)
  return {
    userId: data.userId,
    employeeId: data.employeeId,
  }
}
