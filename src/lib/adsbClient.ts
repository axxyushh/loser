import { parseFeed } from './normalize'
import type { Aircraft } from './types'

const DIRECT_BASE: string = import.meta.env.VITE_ADSB_BASE ?? 'https://api.adsb.lol'
const PROXY_BASE: string = import.meta.env.VITE_ADSB_PROXY ?? '/api/adsb'
const TIMEOUT_MS = 12_000

export class FeedError extends Error {
  status: number | null
  retryAfterMs: number | null
  constructor(message: string, status: number | null = null, retryAfterMs: number | null = null) {
    super(message)
    this.name = 'FeedError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Whether direct browser calls to api.adsb.lol work is only known at runtime
 * (CORS is not documented in the OpenAPI schema). We try direct first; if the
 * browser blocks it (a TypeError from fetch) we switch to the same-origin
 * proxy for the rest of the session.
 */
let route: 'direct' | 'proxy' = 'direct'

function pointPath(lat: number, lon: number, radiusNm: number): string {
  return `v2/point/${lat}/${lon}/${Math.round(radiusNm)}`
}

async function request(url: string, signal: AbortSignal): Promise<Response> {
  return fetch(url, { signal, headers: { accept: 'application/json' }, cache: 'no-store' })
}

function retryAfter(res: Response): number | null {
  const h = res.headers.get('retry-after')
  if (!h) return null
  const s = Number(h)
  return Number.isFinite(s) ? Math.min(s, 300) * 1000 : null
}

export async function fetchPoint(
  lat: number,
  lon: number,
  radiusNm: number,
  outerSignal?: AbortSignal,
): Promise<{ aircraft: Aircraft[]; nowMs: number }> {
  const path = pointPath(lat, lon, radiusNm)
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  const onOuter = () => ctl.abort()
  outerSignal?.addEventListener('abort', onOuter)

  try {
    // Try the remembered route first, then the other. A route is only remembered
    // once it has actually delivered a response, so a transient outage can't pin us
    // to a route that doesn't exist (e.g. no proxy on a static host).
    const attempts: Array<['direct' | 'proxy', string]> = [
      ['direct', `${DIRECT_BASE}/${path}`],
      ['proxy', `${PROXY_BASE}?path=${encodeURIComponent(path)}`],
    ]
    if (route === 'proxy') attempts.reverse()
    let res: Response | null = null
    let netErr: unknown = null
    for (const [kind, url] of attempts) {
      try {
        const r = await request(url, ctl.signal)
        // A missing/broken proxy (404/405/502) says nothing about the source; try the other route.
        if (kind === 'proxy' && [404, 405, 502].includes(r.status)) continue
        res = r
        route = kind
        break
      } catch (err) {
        if (ctl.signal.aborted) throw err
        netErr = err
      }
    }
    if (!res) throw netErr ?? new Error('unreachable')

    if (!res.ok) {
      throw new FeedError(
        res.status === 429 ? 'Rate limited by the data source' : `Data source returned ${res.status}`,
        res.status,
        retryAfter(res),
      )
    }
    let body: unknown
    try {
      body = await res.json()
    } catch {
      throw new FeedError('Data source returned unreadable data')
    }
    try {
      return parseFeed(body, Date.now())
    } catch (e) {
      throw new FeedError(e instanceof Error ? e.message : 'Malformed response')
    }
  } catch (err) {
    if (err instanceof FeedError) throw err
    if (outerSignal?.aborted) throw err
    if (ctl.signal.aborted) throw new FeedError('Data source timed out')
    throw new FeedError('Could not reach the data source')
  } finally {
    clearTimeout(timer)
    outerSignal?.removeEventListener('abort', onOuter)
  }
}

/** Test hook. */
export function _resetRoute(): void {
  route = 'direct'
}
