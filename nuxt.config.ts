const baseURL = `/${(process.env.NUXT_APP_BASE_URL || '/').split('/').filter(Boolean).join('/')}/`.replace('//', '/')
const publicPath = (path: string) => `${baseURL}${path.replace(/^\//, '')}`

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  fonts: {
    families: [
      { name: 'Geist', provider: 'google', weights: [400, 500, 600] }
    ]
  },
  ssr: true,
  typescript: { strict: true, typeCheck: false },
  colorMode: { preference: 'system', fallback: 'light' },
  icon: { serverBundle: 'local', clientBundle: { scan: true } },
  nitro: { prerender: { routes: ['/', '/disciplinas', '/preferencias', '/simulador', '/assistente', '/disciplinas/_shell'] } },
  // Páginas de detalhe dependem do localStorage: renderizam só no cliente,
  // o que também permite abrir qualquer disciplina offline a partir do shell em cache.
  routeRules: { '/disciplinas/**': { ssr: false } },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Calculadora de Médias',
      short_name: 'Médias',
      description: 'Notas, médias ponderadas e simulação de aprovação.',
      lang: 'pt-BR',
      display: 'standalone',
      orientation: 'portrait',
      start_url: baseURL,
      scope: baseURL,
      theme_color: '#1d4ed8',
      background_color: '#ffffff',
      categories: ['education', 'productivity'],
      icons: [
        { src: publicPath('pwa-192.png'), sizes: '192x192', type: 'image/png' },
        { src: publicPath('pwa-512.png'), sizes: '512x512', type: 'image/png' },
        { src: publicPath('pwa-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ],
      shortcuts: [
        { name: 'Disciplinas', url: publicPath('disciplinas'), icons: [{ src: publicPath('pwa-192.png'), sizes: '192x192' }] }
      ]
    },
    workbox: {
      // Shell sem conteúdo (ssr:false): evita divergência de hidratação ao abrir rotas dinâmicas offline.
      navigateFallback: publicPath('disciplinas/_shell/index.html'),
      navigateFallbackDenylist: [/^\/api\//],
      globPatterns: ['**/*.{js,css,html,json,png,svg,ico,woff2,woff}'],
      // O Nuxt acrescenta ?_b=<build> ao buscar _payload.json; ignorar para casar com o pré-cache.
      ignoreURLParametersMatching: [/^_b$/],
      cleanupOutdatedCaches: true
    },
    client: { installPrompt: true },
    devOptions: { enabled: false }
  },
  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Calculadora de Médias',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: publicPath('icon.svg') },
        { rel: 'apple-touch-icon', href: publicPath('apple-touch-icon.png') }
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fafafa', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#09090b', media: '(prefers-color-scheme: dark)' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Médias' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'description', content: 'Gerencie notas, calcule médias ponderadas e simule a aprovação nas suas disciplinas.' }
      ]
    }
  }
})
