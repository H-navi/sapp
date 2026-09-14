import { SESSION_COOKIE, revokeSession } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) await revokeSession(token)
  deleteCookie(event, SESSION_COOKIE)
  return { data: { ok: true } }
})
