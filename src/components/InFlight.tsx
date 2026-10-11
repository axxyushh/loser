import type { Freshness } from '../hooks/useTraffic'
import { dash, displayName, fmtAltitude, fmtSpeed } from '../lib/format'
import { REGIONS } from '../lib/regions'
import type { RegionId, RegionSnapshot } from '../lib/types'

export function InFlight({ region, snap, freshness }: { region: RegionId; snap: RegionSnapshot; freshness: Freshness }) {
  const list = snap.aircraft
  const highest = list.reduce<(typeof list)[number] | null>((b, a) => (a.altitudeFt !== null && (!b || a.altitudeFt > (b.altitudeFt ?? -1)) ? a : b), null)
  const fastest = list.reduce<(typeof list)[number] | null>((b, a) => (a.groundSpeedKt !== null && (!b || a.groundSpeedKt > (b.groundSpeedKt ?? -1)) ? a : b), null)
  const airborne = list.filter((a) => !a.onGround).length
  const have = snap.lastSuccessAt !== null && list.length > 0
  const tag = freshness === 'live' ? 'live' : freshness === 'stale' ? 'stale' : null

  return (
    <section id="inflight" className="inf" aria-labelledby="inf-title" data-scene-id="3">
      <div className="wrap inf__grid">
        <header>
          <p className="eyebrow mono">Scene 03 — In flight</p>
          <h2 id="inf-title" className="display inf__title">The sky, as reported.</h2>
          <p className="lede">
            Volunteers run small ADS-B receivers; ADSB.lol gathers what they hear. What follows is that
            raw signal, shaped into something you can browse — never simulated.
          </p>
        </header>
        <dl className="inf__stats" aria-label={`Snapshot of ${REGIONS[region].label} airspace${tag ? `, ${tag}` : ''}`}>
          <div>
            <dt className="mono">Tracked over {REGIONS[region].label}</dt>
            <dd>{have ? list.length.toLocaleString('en-US') : dash}</dd>
            <p className="mono inf__sub">{have ? `${airborne.toLocaleString('en-US')} airborne` : 'waiting for data'}</p>
          </div>
          <div>
            <dt className="mono">Highest</dt>
            <dd>{highest ? fmtAltitude(highest.altitudeFt, false) : dash}</dd>
            <p className="mono inf__sub">{highest ? displayName(highest).text : ' '}</p>
          </div>
          <div>
            <dt className="mono">Fastest</dt>
            <dd>{fastest ? fmtSpeed(fastest.groundSpeedKt) : dash}</dd>
            <p className="mono inf__sub">{fastest ? displayName(fastest).text : ' '}</p>
          </div>
        </dl>
        {tag === 'stale' && <p className="note note--warn">These figures come from the last successful update and may be out of date.</p>}
      </div>
    </section>
  )
}
