/** Internal, presentation-agnostic aircraft model (normalized from ADSB.lol `V2Response_AcItem`). */
export interface Aircraft {
  /** ICAO 24-bit hex address. Stable identifier used for React keys. */
  id: string
  callsign: string | null
  registration: string | null
  typeCode: string | null
  lat: number
  lon: number
  /** Barometric altitude in feet; null when unknown or on the ground. */
  altitudeFt: number | null
  onGround: boolean
  geomAltitudeFt: number | null
  groundSpeedKt: number | null
  iasKt: number | null
  tasKt: number | null
  mach: number | null
  trackDeg: number | null
  trueHeadingDeg: number | null
  magHeadingDeg: number | null
  verticalRateFpm: number | null
  squawk: string | null
  emergency: string | null
  category: string | null
  /** Raw ADSB.lol `type` field (message source class, e.g. adsb_icao, mlat). */
  source: string
  /** Seconds since the position was last updated, as reported at fetch time. */
  seenPosSec: number
  /** Epoch ms the position was observed (feed `now` minus seen_pos). */
  observedAt: number
}

export type RegionId = 'eu' | 'usa' | 'asia'

export interface Seed {
  name: string
  lat: number
  lon: number
}

export interface Region {
  id: RegionId
  label: string
  short: string
  /** Inclusive bounding box; aircraft outside are dropped after fetching. */
  bbox: { south: number; north: number; west: number; east: number }
  /** Query centres. Each is requested with `radius` nautical miles. */
  seeds: Seed[]
  blurb: string
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export interface RegionSnapshot {
  status: LoadStatus
  aircraft: Aircraft[]
  /** Aircraft kept after bbox filter + dedupe. */
  total: number
  lastSuccessAt: number | null
  /** Set when the most recent attempt failed entirely. Cleared on success. */
  error: string | null
  refreshing: boolean
  /** Seed queries that failed in the last successful refresh. */
  failedSeeds: number
  seedCount: number
  nextAttemptAt: number | null
  /** Consecutive failed attempts (drives backoff). */
  failures: number
}
