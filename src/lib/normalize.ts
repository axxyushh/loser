import { inBBox } from './geo'
import type { Aircraft, Region } from './types'

/** Loose shape of what the API returns; every field is untrusted. */
type Raw = Record<string, unknown>

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}

/**
 * Convert one raw `V2Response_AcItem` into an Aircraft, or null when it has
 * no usable position. `alt_baro` may be a number, the string "ground", or null.
 */
export function normalizeAircraft(raw: unknown, feedNowMs: number): Aircraft | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Raw
  const hex = str(r.hex)
  const lat = num(r.lat)
  const lon = num(r.lon)
  if (!hex || lat === null || lon === null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null

  const altRaw = r.alt_baro
  const onGround = altRaw === 'ground'
  const seenPos = num(r.seen_pos) ?? num(r.seen) ?? 0

  return {
    id: hex.toLowerCase(),
    callsign: str(r.flight),
    registration: str(r.r),
    typeCode: str(r.t),
    lat,
    lon,
    altitudeFt: onGround ? null : num(altRaw),
    onGround,
    geomAltitudeFt: num(r.alt_geom),
    groundSpeedKt: num(r.gs),
    iasKt: num(r.ias),
    tasKt: num(r.tas),
    mach: num(r.mach),
    trackDeg: num(r.track),
    trueHeadingDeg: num(r.true_heading),
    magHeadingDeg: num(r.mag_heading),
    verticalRateFpm: num(r.baro_rate) ?? num(r.geom_rate),
    squawk: str(r.squawk),
    emergency: str(r.emergency),
    category: str(r.category),
    source: str(r.type) ?? 'unknown',
    seenPosSec: Math.max(0, seenPos),
    observedAt: feedNowMs - Math.max(0, seenPos) * 1000,
  }
}

export interface ParsedFeed {
  aircraft: Aircraft[]
  /** Feed timestamp in ms (API `now`), falling back to local time. */
  nowMs: number
}

/** Parse a `V2Response_Model` body. Throws if it is not the expected envelope. */
export function parseFeed(body: unknown, fallbackNowMs: number): ParsedFeed {
  if (!body || typeof body !== 'object') throw new Error('Malformed response')
  const b = body as Raw
  if (!Array.isArray(b.ac)) throw new Error('Response has no aircraft list')
  const apiNow = num(b.now)
  // `now` is epoch ms in readsb-style feeds; distrust values that are wildly off.
  const nowMs = apiNow !== null && Math.abs(apiNow - fallbackNowMs) < 10 * 60_000 ? apiNow : fallbackNowMs
  const aircraft: Aircraft[] = []
  for (const item of b.ac) {
    const a = normalizeAircraft(item, nowMs)
    if (a) aircraft.push(a)
  }
  return { aircraft, nowMs }
}

/** Merge feeds, drop anything outside the region, and keep the freshest record per ICAO hex. */
export function mergeForRegion(feeds: Aircraft[][], region: Region): Aircraft[] {
  const byId = new Map<string, Aircraft>()
  for (const feed of feeds) {
    for (const a of feed) {
      if (!inBBox(a.lat, a.lon, region.bbox)) continue
      const prev = byId.get(a.id)
      if (!prev || a.observedAt > prev.observedAt) byId.set(a.id, a)
    }
  }
  return [...byId.values()]
}
