import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  devtools: { enabled: false },
  ssr: false,

  modules: ['@pinia/nuxt', '@vite-pwa/nuxt'],

  components: [{ path: '~/components', pathPrefix: false }],

  css: ['~/assets/css/tokens.css', '~/assets/css/base.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    dbPath: process.env.NUXT_DB_PATH || './data/learning.db',
    migrationsDir: process.env.NUXT_MIGRATIONS_DIR || './server/db/migrations',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'de-CH' },
      link: [
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/icon.svg' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#12121a' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      title: 'Training',
    },
  },

  nitro: {
    minify: true,
    prerender: {
      routes: ['/'],
      crawlLinks: false,
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Kognitives Training',
      short_name: 'Training',
      description: 'Tägliches kognitives Training mit Notenband',
      lang: 'de-CH',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f4f1ea',
      theme_color: '#12121a',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//],
      maximumFileSizeToCacheInBytes: 4_000_000,
      runtimeCaching: [],
      cleanupOutdatedCaches: true,
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },
})
