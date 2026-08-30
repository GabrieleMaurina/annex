import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
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
  ],
  optimizeDeps: {
    include: ['engine'],
  },
  server: {
    port: 5000,
    open: true,
  },
})
