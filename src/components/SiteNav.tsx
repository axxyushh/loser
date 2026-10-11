import { REGIONS, REGION_ORDER } from '../lib/regions'
import type { RegionId } from '../lib/types'

export function SiteNav({ region, onRegion, onTop }: { region: RegionId; onRegion: (id: RegionId) => void; onTop: () => void }) {
  return (
    <header className="nav">
      <a className="skip" href="#airspace">Skip to aircraft</a>
      <button type="button" className="nav__brand" onClick={onTop} aria-label="THE LOSER — back to top">THE LOSER</button>
      <nav className="nav__links" aria-label="Regions">
        {REGION_ORDER.map((id) => (
          <button key={id} type="button" className={id === region ? 'is-active' : ''} onClick={() => onRegion(id)}>
            <span className="nav__long">{REGIONS[id].label}</span>
            <span className="nav__short mono">{REGIONS[id].short}</span>
          </button>
        ))}
      </nav>
    </header>
  )
}
