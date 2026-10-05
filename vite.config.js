import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Serves /api/* from server/handler.js under `vite` and `vite preview`, the way
 * Vercel runs api/*.js in production. Without DATABASE_URL the data goes to
 * .data/lms-db.json.
 */
function portalApi() {
  const mount = (server) => {
    server.middlewares.use(async (req, res, next) => {
      // /api/v1/users reaches the v1 route, as the rewrite in vercel.json does in production.
      const route = req.url?.match(/^\/api\/([\w-]+)(?:[/?]|$)/)?.[1]
      if (!route) return next()
      const { handle } = await import(pathToFileURL(resolve('server/handler.js')).href)
      await handle(req, res, route)
    })
  }
  return { name: 'portal-api', configureServer: mount, configurePreviewServer: mount }
}

export default defineConfig({
  plugins: [react(), portalApi()],
  server: { port: 5173, open: true },
})
