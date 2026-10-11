import type { Aircraft } from './types'

/** The featured identifier shown after the morph. It is a name, not a tracked flight. */
export const FEATURED = 'LO702'

/** Decorative identifiers used only when no live callsigns are available. */
export const DECORATIVE = ['BA482', 'DL184', 'LH921', 'AI274']

export interface IdentifierSet {
  ids: string[]
  /** True when `ids` after the featured one are real callsigns from the fetched feed. */
  live: boolean
}

const OK = /^[A-Z0-9]{4,7}$/

/**
 * Pick a few real callsigns from the current feed (spread across the list so they
 * differ), falling back to clearly-labelled decorative identifiers.
 */
export function pickIdentifiers(aircraft: Aircraft[]): IdentifierSet {
  const seen = new Set<string>([FEATURED])
  const pool: string[] = []
  for (const a of aircraft) {
    const c = a.callsign?.toUpperCase()
    if (c && OK.test(c) && /[0-9]/.test(c) && !seen.has(c)) {
      seen.add(c)
      pool.push(c)
    }
  }
  if (pool.length < 4) return { ids: [FEATURED, ...DECORATIVE], live: false }
  pool.sort()
  const step = Math.floor(pool.length / 4)
  const picks = [0, 1, 2, 3].map((i) => pool[Math.min(pool.length - 1, i * step + Math.floor(step / 2))] as string)
  return { ids: [FEATURED, ...picks], live: true }
}
