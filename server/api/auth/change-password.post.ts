import { z } from 'zod'
import { eq, and, ne } from 'drizzle-orm'
import { useDatabase, schema } from '~~/server/database'
import { withTransaction } from '~~/server/utils/transaction'
import { requireAuth } from '~~/server/utils/guard'
import { SESSION_COOKIE, hashPassword, hashToken, verifyPassword } from '~~/server/utils/auth'
import { writeAuditLog } from '~~/server/utils/audit'

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Password lama wajib diisi'),
    newPassword: z
      .string()
      .min(8, 'Password baru minimal 8 karakter')
      .regex(/[a-zA-Z]/, 'Password baru harus mengandung huruf')
      .regex(/[0-9]/, 'Password baru harus mengandung angka'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok dengan password baru',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.oldPassword, {
    message: 'Password baru tidak boleh sama dengan password lama',
    path: ['newPassword'],
  })

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const { oldPassword, newPassword } = await readValidatedBody(event, changePasswordSchema.parse)

  const db = useDatabase()
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, auth.userId))
    .limit(1)

  if (!user || !verifyPassword(oldPassword, user.passwordHash)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'AUTH_WRONG_PASSWORD',
      message: 'Password lama tidak cocok.',
    })
  }

  const currentToken = getCookie(event, SESSION_COOKIE)
  const currentTokenHash = currentToken ? hashToken(currentToken) : null
  const newHash = hashPassword(newPassword)

  await withTransaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
      })
      .where(eq(schema.users.id, auth.userId))

    // Cabut semua sesi lain milik user ini
    if (currentTokenHash) {
      await tx
        .update(schema.userSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.userSessions.userId, auth.userId),
            ne(schema.userSessions.tokenHash, currentTokenHash)
          )
        )
    }

    await writeAuditLog(tx, {
      actorUserId: auth.userId,
      action: 'CHANGE_PASSWORD',
      entityType: 'users',
      entityId: auth.userId,
    })
  })

  return { data: { ok: true } }
})
