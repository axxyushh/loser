import { useNow } from '../hooks/useNow'
import type { Freshness } from '../hooks/useTraffic'
import { fmtAge, fmtClock } from '../lib/format'
import type { RegionSnapshot } from '../lib/types'

interface Props {
  snap: RegionSnapshot
  freshness: Freshness
  onRefresh: () => void
}

export function StatusBar({ snap, freshness, onRefresh }: Props) {
  const now = useNow()
  const loading = snap.status === 'loading' || (snap.status === 'idle' && snap.lastSuccessAt === null)
  let tone: 'live' | 'stale' | 'error' | 'loading' = 'loading'
  let label = 'Connecting'
  if (freshness === 'live') {
    tone = 'live'
    label = 'Live'
  } else if (freshness === 'stale') {
    tone = 'stale'
    label = 'Stale'
  } else if (snap.status === 'error') {
    tone = 'error'
    label = 'Unavailable'
  } else if (loading) {
    tone = 'loading'
    label = 'Loading'
  }

  const updated =
    snap.lastSuccessAt === null
      ? 'No successful update yet'
      : `Updated ${fmtClock(snap.lastSuccessAt)} · ${fmtAge((now - snap.lastSuccessAt) / 1000)}`
  const next = snap.nextAttemptAt && !snap.refreshing ? Math.max(0, Math.round((snap.nextAttemptAt - now) / 1000)) : null

  return (
    <div className="sb" role="status" aria-live="polite">
      <span className={`sb__chip is-${tone}`}>
        <span className="fresh__dot" aria-hidden="true" />
        {label}
      </span>
      <span className="sb__text mono">
        {updated}
        {snap.failedSeeds > 0 && freshness === 'live' ? ` · partial (${snap.failedSeeds}/${snap.seedCount} areas missed)` : ''}
        {next !== null && snap.error === null ? ` · next in ${next}s` : ''}
      </span>
      <button type="button" className="sb__btn" onClick={onRefresh} disabled={snap.refreshing} aria-label="Refresh aircraft now">
        <svg viewBox="0 0 24 24" className={snap.refreshing ? 'is-spin' : ''} aria-hidden="true" focusable="false">
          <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{snap.refreshing ? 'Refreshing' : 'Refresh'}</span>
      </button>
    </div>
  )
}
