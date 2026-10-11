import { memo } from 'react'
import { useNow } from '../hooks/useNow'
import { dash, displayName, fmtAge, fmtAltitude, fmtSpeed, fmtTrack } from '../lib/format'
import { formatCoord } from '../lib/geo'
import type { Aircraft } from '../lib/types'
import { Airliner } from './Airliner'

export function isLive(a: Aircraft, regionHealthy: boolean): boolean {
  // "Live" = the region refreshed recently AND the position itself was fresh when fetched.
  return regionHealthy && a.seenPosSec <= 60
}

function Observed({ at }: { at: number }) {
  const now = useNow()
  return <>{fmtAge(Math.max(0, (now - at) / 1000))}</>
}

export function FreshBadge({ live }: { live: boolean }) {
  return (
    <span className={`fresh ${live ? 'is-live' : 'is-stale'}`}>
      <span className="fresh__dot" aria-hidden="true" />
      {live ? 'Live' : 'Stale'}
    </span>
  )
}

interface Props {
  a: Aircraft
  live: boolean
  selected: boolean
  onOpen: (id: string) => void
}

function FlightCardBase({ a, live, selected, onOpen }: Props) {
  const name = displayName(a)
  const sub = [a.typeCode, a.callsign ? a.registration : null].filter(Boolean).join(' · ')
  return (
    <li className="fc-wrap">
      <button
        type="button"
        className={`fc${selected ? ' is-selected' : ''}`}
        data-flight={a.id}
        aria-haspopup="dialog"
        onClick={() => onOpen(a.id)}
      >
        <span className="fc__top">
          <span className="fc__kind mono">
            {name.kind === 'callsign' ? 'Callsign' : name.kind === 'registration' ? 'Registration' : 'ICAO hex'}
          </span>
          <FreshBadge live={live} />
        </span>
        <span className="fc__name">{name.text}</span>
        <span className="fc__sub mono">{sub || 'Type not reported'}</span>
        <span className="fc__sil" aria-hidden="true">
          <span
            className="fc__rot"
            style={{ transform: `rotate(${(a.trackDeg ?? 0) - 90}deg)`, opacity: a.trackDeg === null ? 0.25 : 1 }}
          >
            <Airliner className="fc__plane" />
          </span>
        </span>
        <dl className="fc__grid">
          <div>
            <dt>Alt</dt>
            <dd>{fmtAltitude(a.altitudeFt, a.onGround)}</dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>{fmtSpeed(a.groundSpeedKt)}</dd>
          </div>
          <div>
            <dt>Track</dt>
            <dd>{fmtTrack(a.trackDeg)}</dd>
          </div>
          <div>
            <dt>Seen</dt>
            <dd>
              <Observed at={a.observedAt} />
            </dd>
          </div>
        </dl>
        <span className="fc__pos mono">
          {formatCoord(a.lat, 'lat')} · {formatCoord(a.lon, 'lon')}
        </span>
      </button>
    </li>
  )
}

export const FlightCard = memo(FlightCardBase, (p, n) =>
  p.live === n.live &&
  p.selected === n.selected &&
  p.onOpen === n.onOpen &&
  (p.a === n.a ||
    (p.a.observedAt === n.a.observedAt &&
      p.a.lat === n.a.lat &&
      p.a.lon === n.a.lon &&
      p.a.altitudeFt === n.a.altitudeFt &&
      p.a.groundSpeedKt === n.a.groundSpeedKt &&
      p.a.trackDeg === n.a.trackDeg &&
      p.a.callsign === n.a.callsign)),
)

export { dash }
