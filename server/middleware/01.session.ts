import { SESSION_COOKIE, resolveSession, loadAuthContext } from '../utils/auth'

export default defineEventHandler(async (event) => {
  event.context.auth = null
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return

  const session = await resolveSession(token)
  if (!session) {
    deleteCookie(event, SESSION_COOKIE)
    return
  }
  event.context.auth = await loadAuthContext(session.userId)
})
