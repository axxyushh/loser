import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Dev-only stand-in for api/adsb.ts so the same-origin proxy fallback
 * works under `npm run dev` and `npm run preview`.
 */
const PATH_RE = /^v2\/point\/-?\d{1,3}(\.\d+)?\/-?\d{1,3}(\.\d+)?\/\d{1,3}$/

function adsbProxy(): Plugin {
  const handler = async (
    req: { url?: string },
    res: {
      statusCode: number
      setHeader: (k: string, v: string) => void
      end: (b?: string | Uint8Array) => void
    },
    next: () => void,
  ) => {
    if (!req.url?.startsWith('/api/adsb')) return next()
    const path = new URL(req.url, 'http://local').searchParams.get('path') ?? ''
    if (!PATH_RE.test(path)) {
      res.statusCode = 400
      res.end('bad path')
      return
    }
    try {
      const upstream = await fetch(`https://api.adsb.lol/${path}`, {
        headers: { accept: 'application/json', 'user-agent': 'the-loser-flight-tracker' },
      })
      res.statusCode = upstream.status
      res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
      res.end(new Uint8Array(await upstream.arrayBuffer()))
    } catch {
      res.statusCode = 502
      res.end('upstream unreachable')
    }
  }
  return {
    name: 'adsb-dev-proxy',
    configureServer: (s) => void s.middlewares.use(handler),
    configurePreviewServer: (s) => void s.middlewares.use(handler),
  }
}

export default defineConfig({
  plugins: [react(), adsbProxy()],
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
