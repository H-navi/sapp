import type { AuthContext } from '../utils/auth'

declare module 'h3' {
  interface H3EventContext {
    auth: AuthContext | null
  }
}

export {}
