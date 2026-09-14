export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    // koneksi ditutup otomatis oleh postgres-js saat proses berakhir
  })
})
