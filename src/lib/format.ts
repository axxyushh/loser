export const dash = '—'

export function fmtInt(v: number | null, unit = ''): string {
  if (v === null) return dash
  return `${Math.round(v).toLocaleString('en-US')}${unit}`
}

export function fmtAltitude(ft: number | null, onGround: boolean): string {
  if (onGround) return 'GND'
  return ft === null ? dash : `${Math.round(ft).toLocaleString('en-US')} ft`
}

export function fmtAge(sec: number): string {
  if (sec < 1.5) return 'now'
  if (sec < 90) return `${Math.round(sec)}s ago`
  const m = Math.round(sec / 60)
  if (m < 90) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}

export function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function fmtTrack(deg: number | null): string {
  return deg === null ? dash : `${String(Math.round(deg) % 360).padStart(3, '0')}°`
}

export function fmtSpeed(kt: number | null): string {
  return kt === null ? dash : `${Math.round(kt)} kt`
}

export function fmtRate(fpm: number | null): string {
  if (fpm === null) return dash
  const r = Math.round(fpm)
  return `${r > 0 ? '+' : ''}${r.toLocaleString('en-US')} fpm`
}

/** Display name for an aircraft: callsign, else registration, else ICAO hex. */
export function displayName(a: { callsign: string | null; registration: string | null; id: string }): {
  text: string
  kind: 'callsign' | 'registration' | 'hex'
} {
  if (a.callsign) return { text: a.callsign, kind: 'callsign' }
  if (a.registration) return { text: a.registration, kind: 'registration' }
  return { text: a.id.toUpperCase(), kind: 'hex' }
}
