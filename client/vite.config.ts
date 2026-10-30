import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'

const engineDist = normalizePath(
  fileURLToPath(new URL('../engine/dist', import.meta.url)),
)

const musicTracks = readdirSync(
  fileURLToPath(new URL('./public/music', import.meta.url)),
  { recursive: true, encoding: 'utf8' },
)
  .filter(file => file.endsWith('.mp3'))
  .map(normalizePath)

export default defineConfig({
  define: {
    __MUSIC_TRACKS__: JSON.stringify(musicTracks),
  },
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
      workbox: {
        globPatterns: ['**/*.{js,wasm,css,html,woff2}'],
        globIgnores: [
          '**/WorldMapModal-*',
          '**/maplibre-gl-worker-*.js',
          '**/osmWorker-*.js',
        ],
      },
      manifest: {
        name: 'Annex',
        short_name: 'Annex',
        description:
          'Free online multiplayer strategy war game. Conquer territories, hold continents and outplay friends or AI bots.',
        categories: ['games', 'entertainment'],
        start_url: '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#10151c',
        theme_color: '#10151c',
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
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['import'],
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith('.mjs'))
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  optimizeDeps: {
    include: ['engine', 'maplibre-gl', '@mapbox/vector-tile', 'pbf'],
  },
  server: {
    port: 5000,
    open: true,
  },
})
