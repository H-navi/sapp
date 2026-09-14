import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  srcDir: 'app/',
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  // SSR + server components (island)
  ssr: true,
  experimental: {
    componentIslands: true,
  },

  vue: {
    compilerOptions: {
      // biarkan Vue mengabaikan atribut Alpine saat kompilasi template
      isCustomElement: (tag) => tag.startsWith('x-'),
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#2563eb' },
      ],
      titleTemplate: '%s · Sistem Perizinan Pegawai',
    },
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    sessionSecret: process.env.NUXT_SESSION_SECRET,
    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM,
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
    },
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME ?? 'Sistem Perizinan Pegawai',
      baseUrl: process.env.NUXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
      timezone: 'Asia/Jakarta',
    },
  },

  nitro: {
    // tugas terjadwal diaktifkan pada langkah 09
    experimental: { tasks: true },
  },

  typescript: { strict: true, typeCheck: false },
})
