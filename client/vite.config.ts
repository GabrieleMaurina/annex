import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

const engineDist = normalizePath(
  fileURLToPath(new URL('../engine/dist', import.meta.url)),
)

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'reoptimize-engine',
      configureServer(server) {
        server.watcher.add(engineDist)
        server.watcher.on('change', file => {
          if (normalizePath(file).startsWith(engineDist)) server.restart(true)
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Annex',
        short_name: 'Annex',
        start_url: '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#212529',
        theme_color: '#212529',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    include: ['engine'],
  },
  server: {
    port: 5000,
    open: true,
  },
})
