import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

function devClientLogPlugin(): Plugin {
  return {
    name: 'nomo-dev-client-log',
    configureServer(server) {
      server.middlewares.use('/__nomo/dev-log', (request, response, next) => {
        if (request.method !== 'POST') return next()
        let body = ''
        request.setEncoding('utf8')
        request.on('data', (chunk: string) => {
          if (body.length < 32_768) body += chunk
        })
        request.on('end', () => {
          try {
            const payload = JSON.parse(body) as unknown
            server.config.logger.error(`[mobile-client] ${JSON.stringify(payload, null, 2)}`)
            response.statusCode = 204
            response.end()
          } catch {
            response.statusCode = 400
            response.end('invalid log payload')
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devClientLogPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'maskable-512x512.png'],
      manifest: {
        name: 'Nomo 智能收纳',
        short_name: 'Nomo',
        description: '收起来，也找得回来。Nomo 帮你记住家中每件物品的位置。',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#df6538',
        background_color: '#f8f2e8',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        globIgnores: ['**/heic-to-*.js'],
        runtimeCaching: [{
          urlPattern: /\/assets\/heic-to-.*\.js$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'nomo-heic-decoder',
            expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [200] },
          },
        }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_PUBLIC_APP_ORIGIN: 'http://localhost:5173',
    },
  },
})
