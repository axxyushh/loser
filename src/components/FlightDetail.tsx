import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useNow } from '../hooks/useNow'
import { dash, displayName, fmtAge, fmtAltitude, fmtClock, fmtInt, fmtRate, fmtSpeed, fmtTrack } from '../lib/format'
import { formatCoord } from '../lib/geo'
import type { Aircraft } from '../lib/types'
import { Airliner } from './Airliner'
import { FreshBadge } from './FlightCard'

interface Props {
  aircraft: Aircraft | null
  /** True when the aircraft is no longer in the latest feed (showing last known data). */
  gone: boolean
  live: boolean
  reduced: boolean
  onClose: () => void
}

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="dt__row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function Panel({ aircraft: a, gone, live, onClose }: Omit<Props, 'reduced'> & { aircraft: Aircraft }) {
  const ref = useRef<HTMLDivElement>(null)
  const now = useNow()
  const name = displayName(a)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    document.documentElement.classList.add('is-locked')
    ref.current?.querySelector<HTMLElement>('[data-close]')?.focus()
    return () => {
      root?.removeAttribute('inert')
      document.documentElement.classList.remove('is-locked')
      // Return focus to the card that opened the panel (it keeps a stable key).
      const card = document.querySelector<HTMLElement>(`[data-flight="${CSS.escape(a.id)}"]`)
      ;(card ?? opener)?.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const ageSec = Math.max(0, (now - a.observedAt) / 1000)
  return (
    <div
      ref={ref}
      className="dp"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dp-title"
      onKeyDown={onKey}
    >
      <header className="dp__head">
        <div>
          <p className="mono dp__eyebrow">
            {name.kind === 'callsign' ? 'Callsign' : name.kind === 'registration' ? 'Registration' : 'ICAO hex'}
          </p>
          <h2 id="dp-title" className="dp__title">{name.text}</h2>
          <p className="mono dp__sub">{[a.typeCode, a.registration, a.id.toUpperCase()].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className="dp__close" data-close onClick={onClose} aria-label="Close flight details">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="dp__body">
        <div className="dp__status">
          <FreshBadge live={live && !gone} />
          <span className="mono">
            {gone
              ? 'No longer in range — showing last known data'
              : `Position observed ${fmtAge(ageSec)} · ${fmtClock(a.observedAt)}`}
          </span>
        </div>

        <div className="dp__dial" aria-hidden="true">
          <span className="dp__n">N</span>
          <span className="dp__rot" style={{ transform: `rotate(${(a.trackDeg ?? 0) - 90}deg)`, opacity: a.trackDeg === null ? 0.2 : 1 }}>
            <Airliner className="dp__plane" />
          </span>
        </div>

        <h3 className="dp__h">Flight</h3>
        <dl className="dt">
          <Row k="Altitude (baro)" v={fmtAltitude(a.altitudeFt, a.onGround)} />
          <Row k="Altitude (GPS)" v={a.geomAltitudeFt === null ? dash : `${fmtInt(a.geomAltitudeFt)} ft`} />
          <Row k="Ground speed" v={fmtSpeed(a.groundSpeedKt)} />
          <Row k="Indicated airspeed" v={fmtSpeed(a.iasKt)} />
          <Row k="True airspeed" v={fmtSpeed(a.tasKt)} />
          <Row k="Mach" v={a.mach === null ? dash : a.mach.toFixed(3)} />
          <Row k="Track" v={fmtTrack(a.trackDeg)} />
          <Row k="True heading" v={fmtTrack(a.trueHeadingDeg)} />
          <Row k="Magnetic heading" v={fmtTrack(a.magHeadingDeg)} />
          <Row k="Vertical rate" v={fmtRate(a.verticalRateFpm)} />
        </dl>

        <h3 className="dp__h">Position</h3>
        <dl className="dt">
          <Row k="Latitude" v={formatCoord(a.lat, 'lat')} />
          <Row k="Longitude" v={formatCoord(a.lon, 'lon')} />
          <Row k="Decimal" v={<span className="mono">{a.lat.toFixed(5)}, {a.lon.toFixed(5)}</span>} />
        </dl>

        <h3 className="dp__h">Identity & signal</h3>
        <dl className="dt">
          <Row k="ICAO hex" v={<span className="mono">{a.id.toUpperCase()}</span>} />
          <Row k="Aircraft type" v={a.typeCode ?? dash} />
          <Row k="Registration" v={a.registration ?? dash} />
          <Row k="Category" v={a.category ?? dash} />
          <Row k="Squawk" v={a.squawk ?? dash} />
          <Row k="Emergency status" v={a.emergency && a.emergency !== 'none' ? a.emergency : 'None reported'} />
          <Row k="Source" v={<span className="mono">{a.source}</span>} />
        </dl>

        <p className="dp__note">
          Departure, destination, airline and schedule are not part of ADSB.lol position data, so they are
          not shown rather than guessed.
        </p>
        <a
          className="dp__link"
          href={`https://globe.adsb.lol/?icao=${encodeURIComponent(a.id)}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open on the ADSB.lol globe ↗
        </a>
      </div>
    </div>
  )
}

export function FlightDetail({ aircraft, gone, live, reduced, onClose }: Props) {
  return createPortal(
    <AnimatePresence>
      {aircraft && (
        <>
          <motion.div
            key="scrim"
            className="scrim"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          />
          <motion.div
            key="panel"
            className="dp-wrap"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: reduced ? 0.01 : 0.3, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Panel aircraft={aircraft} gone={gone} live={live} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
