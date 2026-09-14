import type { AuthContext } from '~~/server/utils/auth'

export function useAuth() {
  const user = useState<AuthContext | null>('auth:user', () => null)

  async function fetchMe() {
    try {
      const { data } = await $fetch<{ data: AuthContext | null }>('/api/auth/me')
      user.value = data
      return data
    } catch {
      user.value = null
      return null
    }
  }

  async function login(identifier: string, password: string) {
    const { data } = await $fetch<{ data: AuthContext }>('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    })
    user.value = data
    await navigateTo(data.mustChangePassword ? '/ganti-password' : '/')
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
      await navigateTo('/login')
    }
  }

  const can = (code: string) => user.value?.permissions.includes(code) ?? false
  const hasRole = (role: string) => user.value?.roles.includes(role) ?? false

  return { user, fetchMe, login, logout, can, hasRole }
}
