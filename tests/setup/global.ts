import 'dotenv/config'
import { createError } from 'h3'

// Polyfill Nuxt / Nitro auto-imports in Vitest environment
if (!(globalThis as any).createError) {
  ;(globalThis as any).createError = createError
}
if (!(globalThis as any).defineTask) {
  ;(globalThis as any).defineTask = (def: any) => def
}
