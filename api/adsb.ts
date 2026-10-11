import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Thin same-origin proxy for api.adsb.lol, used only when the browser cannot
 * call the API directly (CORS). It only forwards `v2/point/{lat}/{lon}/{radius}`
 * and adds short edge caching so many visitors share one upstream request.
 */
const PATH_RE = /^v2\/point\/-?\d{1,3}(\.\d+)?\/-?\d{1,3}(\.\d+)?\/\d{1,3}$/

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const path = typeof req.query.path === 'string' ? req.query.path : ''
  if (!PATH_RE.test(path)) {
    res.status(400).send('bad path')
    return
  }
  try {
    const upstream = await fetch(`https://api.adsb.lol/${path}`, {
      headers: { accept: 'application/json', 'user-agent': 'the-loser-flight-tracker' },
    })
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    res.setHeader('cache-control', 's-maxage=15, stale-while-revalidate=30')
    const ra = upstream.headers.get('retry-after')
    if (ra) res.setHeader('retry-after', ra)
    res.send(body)
  } catch {
    res.status(502).send('upstream unreachable')
  }
}
