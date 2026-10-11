import { useSyncExternalStore } from 'react'
import { REGIONS, REGION_ORDER } from '../lib/regions'
import { trafficStore } from '../lib/trafficStore'
import type { RegionId } from '../lib/types'

function Tab({ id, active, onSelect }: { id: RegionId; active: boolean; onSelect: (id: RegionId) => void }) {
  const snap = useSyncExternalStore(trafficStore.subscribe, () => trafficStore.get(id))
  const r = REGIONS[id]
  const count = snap.lastSuccessAt === null ? null : snap.total
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      aria-controls="airspace-panel"
      tabIndex={active ? 0 : -1}
      className={`rs__tab${active ? ' is-active' : ''}`}
      onClick={() => onSelect(id)}
    >
      <span className="rs__label">{r.label}</span>
      <span className="rs__short mono">{r.short}</span>
      <span className="rs__count mono" aria-label={count === null ? 'not loaded yet' : `${count} aircraft`}>
        {count === null ? '—' : count.toLocaleString('en-US')}
      </span>
    </button>
  )
}

export function RegionSelector({ region, onSelect }: { region: RegionId; onSelect: (id: RegionId) => void }) {
  const onKey = (e: React.KeyboardEvent) => {
    const i = REGION_ORDER.indexOf(region)
    const n = REGION_ORDER.length
    const moves: Record<string, number> = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }
    const next = moves[e.key]
    if (next === undefined) return
    e.preventDefault()
    const id = REGION_ORDER[next] as RegionId
    onSelect(id)
    requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus())
  }
  return (
    <div className="rs" role="tablist" aria-label="Region" onKeyDown={onKey}>
      {REGION_ORDER.map((id) => (
        <Tab key={id} id={id} active={id === region} onSelect={onSelect} />
      ))}
    </div>
  )
}
