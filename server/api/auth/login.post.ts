import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { useDatabase, schema } from '~~/server/database'
import { withTransaction } from '~~/server/utils/transaction'
import { SESSION_COOKIE, createSession, verifyPassword, loadAuthContext, loginLimits } from '~~/server/utils/auth'
import { writeAuditLog } from '~~/server/utils/audit'

const bodySchema = z.object({
  identifier: z.string().min(3, 'Email atau username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export default defineEventHandler(async (event) => {
  const { identifier, password } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()

  const [user] = await db
    .select()
    .from(schema.users)
    .where(sql`(${schema.users.email} = ${identifier} OR ${schema.users.username} = ${identifier})`)
    .limit(1)

  const pesanUmum = 'Email/username atau password salah.'
  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'AUTH_INVALID_CREDENTIALS', message: pesanUmum })
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw createError({
      statusCode: 423,
      statusMessage: 'AUTH_LOCKED',
      message: `Akun terkunci sementara. Coba lagi setelah ${user.lockedUntil.toLocaleTimeString('id-ID')}.`,
    })
  }

  if (!verifyPassword(password, user.passwordHash)) {
    const gagal = user.failedLoginCount + 1
    await db
      .update(schema.users)
      .set({
        failedLoginCount: gagal,
        lockedUntil:
          gagal >= loginLimits.MAX_FAILED_LOGIN
            ? new Date(Date.now() + loginLimits.LOCK_MINUTES * 60_000)
            : null,
      })
      .where(eq(schema.users.id, user.id))
    throw createError({ statusCode: 401, statusMessage: 'AUTH_INVALID_CREDENTIALS', message: pesanUmum })
  }

  const token = await withTransaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id))
    const { token } = await createSession(
      tx,
      user.id,
      getRequestIP(event, { xForwardedFor: true }),
      getHeader(event, 'user-agent')
    )
    await writeAuditLog(tx, { actorUserId: user.id, action: 'LOGIN', entityType: 'users', entityId: user.id })
    return token
  })

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 3600,
  })

  return { data: await loadAuthContext(user.id) }
})
