import Alpine from 'alpinejs'

export default defineNuxtPlugin((nuxtApp) => {
  // helper global sederhana
  Alpine.data('disclosure', (open = false) => ({
    open,
    toggle() { (this as { open: boolean }).open = !(this as { open: boolean }).open },
    close()  { (this as { open: boolean }).open = false },
  }))

  window.Alpine = Alpine
  Alpine.start()

  // pastikan komponen Alpine di halaman baru ikut diinisialisasi
  nuxtApp.hook('page:finish', () => {
    Alpine.initTree(document.body)
  })
})
