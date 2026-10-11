import { useCallback, useMemo, useState } from 'react'
import type { Freshness } from '../hooks/useTraffic'
import { displayName } from '../lib/format'
import { REGIONS } from '../lib/regions'
import type { Aircraft, RegionId, RegionSnapshot } from '../lib/types'
import { FlightCard, isLive } from './FlightCard'
import { RegionSelector } from './RegionSelector'
import { StatusBar } from './StatusBar'

type Sort = 'alt' | 'spd' | 'az'
const PAGE = 36

function sortAircraft(list: Aircraft[], sort: Sort): Aircraft[] {
  const out = [...list]
  if (sort === 'alt') out.sort((a, b) => (b.altitudeFt ?? -1) - (a.altitudeFt ?? -1) || a.id.localeCompare(b.id))
  else if (sort === 'spd') out.sort((a, b) => (b.groundSpeedKt ?? -1) - (a.groundSpeedKt ?? -1) || a.id.localeCompare(b.id))
  else out.sort((a, b) => displayName(a).text.localeCompare(displayName(b).text) || a.id.localeCompare(b.id))
  return out
}

interface Props {
  region: RegionId
  onRegion: (id: RegionId) => void
  snap: RegionSnapshot
  freshness: Freshness
  onRefresh: () => void
  selectedId: string | null
  onOpen: (id: string) => void
}

export function Airspace({ region, onRegion, snap, freshness, onRefresh, selectedId, onOpen }: Props) {
  const r = REGIONS[region]
  const [sort, setSort] = useState<Sort>('alt')
  const [query, setQuery] = useState('')
  const [airborne, setAirborne] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = snap.aircraft.filter((a) => {
      if (airborne && a.onGround) return false
      if (!q) return true
      return [a.callsign, a.registration, a.typeCode, a.id].some((v) => v?.toLowerCase().includes(q))
    })
    return sortAircraft(base, sort)
  }, [snap.aircraft, sort, query, airborne])

  const open = useCallback((id: string) => onOpen(id), [onOpen])
  const healthy = freshness === 'live'
  const shown = filtered.slice(0, limit)
  const firstLoad = snap.lastSuccessAt === null && snap.status !== 'error'
  const hardError = snap.status === 'error' && snap.lastSuccessAt === null

  return (
    <section id="airspace" className="air" aria-labelledby="air-title" data-scene-id="4">
      <div className="wrap">
        <header className="air__head">
          <p className="eyebrow mono">Scene 04 — Global airspace</p>
          <h2 id="air-title" className="display air__title">Pick a sky.</h2>
          <p className="lede">
            {r.blurb} Aircraft shown are real ADS-B positions relayed by ADSB.lol, filtered to this region’s
            bounds.
          </p>
        </header>

        <RegionSelector region={region} onSelect={onRegion} />

        <div id="airspace-panel" role="tabpanel" aria-labelledby={`tab-${region}`} tabIndex={-1}>
          <StatusBar snap={snap} freshness={freshness} onRefresh={onRefresh} />

          {snap.error && snap.lastSuccessAt !== null && (
            <p className="note note--warn" role="alert">
              Couldn’t refresh just now ({snap.error}). Showing the last successful results from earlier —
              they are marked stale and may be out of date. Retrying automatically.
            </p>
          )}

          <div className="tools">
            <label className="tools__search">
              <span className="sr-only">Search callsign, registration, type or hex</span>
              <input
                type="search"
                inputMode="search"
                placeholder="Search callsign, reg, type…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setLimit(PAGE)
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="tools__sort" role="group" aria-label="Sort aircraft">
              {([['alt', 'Altitude'], ['spd', 'Speed'], ['az', 'A–Z']] as const).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="tools__check">
              <input type="checkbox" checked={airborne} onChange={(e) => setAirborne(e.target.checked)} />
              <span>Airborne only</span>
            </label>
          </div>

          <p className="count mono" aria-live="polite">
            {firstLoad
              ? 'Loading aircraft…'
              : `${filtered.length.toLocaleString('en-US')} of ${snap.total.toLocaleString('en-US')} aircraft in ${r.label}`}
          </p>

          {firstLoad && (
            <ul className="grid" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="fc-wrap"><div className="fc fc--skeleton"><span /><span /><span /><span /></div></li>
              ))}
            </ul>
          )}

          {hardError && (
            <div className="empty" role="alert">
              <p className="empty__t">Flight data is temporarily unavailable.</p>
              <p className="empty__d">{snap.error ?? 'The data source did not respond.'} Nothing is being shown as live. We’ll keep retrying.</p>
              <button type="button" className="btn" onClick={onRefresh}>Try again now</button>
            </div>
          )}

          {!firstLoad && !hardError && snap.total === 0 && (
            <div className="empty">
              <p className="empty__t">No aircraft reported over {r.label} right now.</p>
              <p className="empty__d">The feed returned no positions inside these bounds — that’s the data, not a placeholder. Receiver coverage varies by area and time of day.</p>
              <button type="button" className="btn" onClick={onRefresh}>Check again</button>
            </div>
          )}

          {!firstLoad && snap.total > 0 && filtered.length === 0 && (
            <div className="empty">
              <p className="empty__t">Nothing matches your filters.</p>
              <button type="button" className="btn" onClick={() => { setQuery(''); setAirborne(false) }}>Clear filters</button>
            </div>
          )}

          {shown.length > 0 && (
            <ul className="grid">
              {shown.map((a) => (
                <FlightCard key={a.id} a={a} live={isLive(a, healthy)} selected={a.id === selectedId} onOpen={open} />
              ))}
            </ul>
          )}

          {filtered.length > shown.length && (
            <div className="more">
              <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, filtered.length - shown.length)} more
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
