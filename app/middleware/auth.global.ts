const halamanPublik = ['/login']

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchMe } = useAuth()
  if (!user.value) {
    await fetchMe()
  }

  if (halamanPublik.includes(to.path)) {
    return user.value ? navigateTo('/') : undefined
  }
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  if (user.value.mustChangePassword && to.path !== '/ganti-password') {
    return navigateTo('/ganti-password')
  }
  if (to.path.startsWith('/admin') && !user.value.roles.includes('ADMIN')) {
    throw createError({ statusCode: 403, statusMessage: 'Halaman khusus admin' })
  }
  if (to.path.startsWith('/approval') && !user.value.permissions.includes('approval.view')) {
    throw createError({ statusCode: 403, statusMessage: 'Anda bukan approver' })
  }
})
