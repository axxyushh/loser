import { describe, expect, it } from 'vitest'
import { mergeForRegion, normalizeAircraft, parseFeed } from '../lib/normalize'
import { REGIONS } from '../lib/regions'
import { inBBox } from '../lib/geo'

const NOW = 1_800_000_000_000

describe('normalizeAircraft', () => {
  it('maps a full record', () => {
    const a = normalizeAircraft(
      { hex: 'ABC123', flight: 'BAW482 ', r: 'G-XWBA', t: 'A35K', lat: 51.5, lon: -0.4,
        alt_baro: 36000, gs: 480.2, track: 271.3, seen_pos: 2.5, seen: 1, type: 'adsb_icao' },
      NOW,
    )
    expect(a).toMatchObject({ id: 'abc123', callsign: 'BAW482', registration: 'G-XWBA', altitudeFt: 36000, onGround: false })
    expect(a?.observedAt).toBe(NOW - 2500)
  })

  it('treats "ground" altitude as on-ground, not a number', () => {
    const a = normalizeAircraft({ hex: 'a', lat: 1, lon: 1, alt_baro: 'ground', type: 'x' }, NOW)
    expect(a?.onGround).toBe(true)
    expect(a?.altitudeFt).toBeNull()
  })

  it('drops records without a position or hex', () => {
    expect(normalizeAircraft({ hex: 'a', type: 'x' }, NOW)).toBeNull()
    expect(normalizeAircraft({ lat: 1, lon: 1 }, NOW)).toBeNull()
    expect(normalizeAircraft({ hex: 'a', lat: 91, lon: 0 }, NOW)).toBeNull()
    expect(normalizeAircraft(null, NOW)).toBeNull()
  })

  it('nulls missing/garbage fields instead of inventing values', () => {
    const a = normalizeAircraft({ hex: 'a', lat: 1, lon: 1, gs: 'fast', flight: '  ', t: 5 }, NOW)
    expect(a?.groundSpeedKt).toBeNull()
    expect(a?.callsign).toBeNull()
    expect(a?.typeCode).toBeNull()
  })
})

describe('parseFeed', () => {
  it('rejects malformed envelopes', () => {
    expect(() => parseFeed(null, NOW)).toThrow()
    expect(() => parseFeed({}, NOW)).toThrow()
  })
  it('ignores an implausible `now` and uses local time', () => {
    expect(parseFeed({ ac: [], now: 5 }, NOW).nowMs).toBe(NOW)
    expect(parseFeed({ ac: [], now: NOW + 1000 }, NOW).nowMs).toBe(NOW + 1000)
  })
})

describe('mergeForRegion', () => {
  const mk = (hex: string, lat: number, lon: number, seen: number) =>
    normalizeAircraft({ hex, lat, lon, seen_pos: seen, type: 'x' }, NOW)!

  it('dedupes by hex, keeping the freshest observation', () => {
    const out = mergeForRegion([[mk('aa', 50, 5, 9)], [mk('aa', 50.1, 5.1, 1)]], REGIONS.eu)
    expect(out).toHaveLength(1)
    expect(out[0]?.lat).toBe(50.1)
  })

  it('filters by region box', () => {
    const out = mergeForRegion([[mk('p', 48.8, 2.3, 1), mk('n', 40.7, -74, 1), mk('t', 35.6, 139.7, 1)]], REGIONS.eu)
    expect(out.map((a) => a.id)).toEqual(['p'])
  })
})

describe('region boxes', () => {
  it('do not overlap each other', () => {
    const ids = Object.keys(REGIONS) as (keyof typeof REGIONS)[]
    for (const a of ids) for (const b of ids) {
      if (a === b) continue
      const A = REGIONS[a].bbox, B = REGIONS[b].bbox
      const overlap = A.west < B.east && A.east > B.west && A.south < B.north && A.north > B.south
      expect(overlap, `${a}/${b}`).toBe(false)
    }
  })
  it('every seed lies inside its own region box', () => {
    for (const r of Object.values(REGIONS)) for (const s of r.seeds) expect(inBBox(s.lat, s.lon, r.bbox), s.name).toBe(true)
  })
})
