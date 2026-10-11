// Minimal self-hosting server: serves ./dist and a cached same-origin proxy at /api/adsb
// (used only when the browser cannot call api.adsb.lol directly, e.g. CORS).
//   npm run build && npm start        (PORT=8080 by default)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const PORT = Number(process.env.PORT ?? 8080)
const PATH_RE = /^v2\/point\/-?\d{1,3}(\.\d+)?\/-?\d{1,3}(\.\d+)?\/\d{1,3}$/
const TTL_MS = 15_000
const cache = new Map()
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' }

async function proxy(url, res) {
  const path = url.searchParams.get('path') ?? ''
  if (!PATH_RE.test(path)) { res.writeHead(400).end('bad path'); return }
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL_MS) { res.writeHead(hit.status, { 'content-type': 'application/json', 'x-cache': 'HIT' }).end(hit.body); return }
  try {
    const up = await fetch(`https://api.adsb.lol/${path}`, { headers: { accept: 'application/json', 'user-agent': 'the-loser-flight-tracker' } })
    const body = await up.text()
    if (up.ok) cache.set(path, { at: Date.now(), status: up.status, body })
    const h = { 'content-type': up.headers.get('content-type') ?? 'application/json' }
    const ra = up.headers.get('retry-after'); if (ra) h['retry-after'] = ra
    res.writeHead(up.status, h).end(body)
  } catch { res.writeHead(502).end('upstream unreachable') }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname === '/api/adsb') return proxy(url, res)
  let file = normalize(join(DIST, url.pathname === '/' ? 'index.html' : url.pathname))
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html') } catch { file = join(DIST, 'index.html') }
  try {
    const data = await readFile(file)
    const long = file.includes('/assets/')
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': long ? 'public, max-age=31536000, immutable' : 'no-cache' }).end(data)
  } catch { res.writeHead(404).end('not found') }
}).listen(PORT, () => console.log(`THE LOSER on http://localhost:${PORT}`))
