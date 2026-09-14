import { randomBytes } from 'node:crypto'

interface TokenData {
  employeeId: string
  expiresAt: number
}

// In-memory token store untuk penautan Telegram (berlaku 15 menit)
const linkingStore = new Map<string, TokenData>()

export function createTelegramLinkingToken(employeeId: string): string {
  const token = randomBytes(12).toString('hex')
  const expiresAt = Date.now() + 15 * 60 * 1000 // 15 menit

  linkingStore.set(token, { employeeId, expiresAt })

  // Bersihkan token yang sudah lewat waktu kadaluarsa
  const now = Date.now()
  for (const [k, v] of linkingStore.entries()) {
    if (v.expiresAt < now) {
      linkingStore.delete(k)
    }
  }

  return token
}

export function verifyTelegramLinkingToken(token: string): string | null {
  const data = linkingStore.get(token)
  if (!data) return null

  if (data.expiresAt < Date.now()) {
    linkingStore.delete(token)
    return null
  }

  // Token sekali pakai: hapus setelah diverifikasi
  linkingStore.delete(token)
  return data.employeeId
}
