import { createError, type H3Event } from 'h3'
import type { AuthContext } from './auth'

export function requireAuth(event: H3Event): AuthContext {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'AUTH_REQUIRED', message: 'Silakan login terlebih dahulu.' })
  }
  return auth
}

export function requirePermission(event: H3Event, ...codes: string[]): AuthContext {
  const auth = requireAuth(event)
  const punya = codes.some((c) => auth.permissions.includes(c))
  if (!punya) {
    throw createError({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN', message: 'Anda tidak memiliki hak akses untuk tindakan ini.' })
  }
  return auth
}

export function requireRole(event: H3Event, ...roles: string[]): AuthContext {
  const auth = requireAuth(event)
  if (!roles.some((r) => auth.roles.includes(r))) {
    throw createError({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN', message: 'Halaman ini khusus untuk ' + roles.join('/') + '.' })
  }
  return auth
}

/** Pegawai hanya boleh melihat datanya sendiri, kecuali punya izin lebih luas. */
export function assertCanViewEmployee(auth: AuthContext, employeeId: string) {
  if (auth.employeeId === employeeId) return
  if (auth.permissions.includes('request.view.all') || auth.permissions.includes('request.view.team')) return
  throw createError({ statusCode: 403, statusMessage: 'AUTH_FORBIDDEN', message: 'Data ini bukan milik Anda.' })
}
