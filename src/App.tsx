import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMotionValueEvent } from 'motion/react'
import { Airspace } from './components/Airspace'
import { Arrival } from './components/Arrival'
import { FlightDetail } from './components/FlightDetail'
import { isLive } from './components/FlightCard'
import { InFlight } from './components/InFlight'
import { PlaneLayer } from './components/PlaneLayer'
import { SiteNav } from './components/SiteNav'
import { WordMark } from './components/WordMark'
import { useJourney } from './hooks/useJourney'
import { useTraffic } from './hooks/useTraffic'
import { pickIdentifiers } from './lib/identifiers'
import { REGIONS } from './lib/regions'
import type { Aircraft, RegionId } from './lib/types'

/** Start on the region closest to the visitor's time zone; purely a convenience. */
function defaultRegion(): RegionId {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz.startsWith('America/')) return 'usa'
    if (tz.startsWith('Asia/') || tz.startsWith('Australia/') || tz.startsWith('Pacific/')) return 'asia'
  } catch { /* ignore */ }
  return 'eu'
}

export function App() {
  const [region, setRegion] = useState<RegionId>(defaultRegion)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastSeen, setLastSeen] = useState<Aircraft | null>(null)
  const heroRef = useRef<HTMLElement>(null)
  const markRef = useRef<HTMLDivElement>(null)

  const { snap, freshness, refresh } = useTraffic(region, true)
  const j = useJourney(heroRef, markRef)
  const identifiers = useMemo(() => pickIdentifiers(snap.aircraft), [snap.aircraft])

  // Scene attribute drives background tone + plane stacking via CSS.
  const setScene = useCallback((n: number) => { document.documentElement.dataset.scene = String(n) }, [])
  useMotionValueEvent(j.morph, 'change', (m) => {
    if (document.documentElement.dataset.scene === '1' || document.documentElement.dataset.scene === '2') setScene(m > 0.5 ? 2 : 1)
  })
  useEffect(() => {
    setScene(j.morph.get() > 0.5 ? 2 : 1)
    const els = document.querySelectorAll<HTMLElement>('[data-scene-id]')
    const io = new IntersectionObserver(
      (entries) => {
        // Choose the scene whose section crosses the middle of the viewport.
        for (const e of entries) {
          if (e.isIntersecting) setScene(Number((e.target as HTMLElement).dataset.sceneId))
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    const hero = heroRef.current
    const heroIo = new IntersectionObserver(
      ([e]) => { if (e?.isIntersecting) setScene(j.morph.get() > 0.5 ? 2 : 1) },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    if (hero) heroIo.observe(hero)
    return () => { io.disconnect(); heroIo.disconnect() }
  }, [j.morph, setScene])

  const scrollTo = useCallback((id: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [])
  const goRegion = useCallback((id: RegionId) => { setRegion(id) }, [])
  const goRegionAndScroll = useCallback((id: RegionId) => { setRegion(id); scrollTo('airspace') }, [scrollTo])
  const top = useCallback(() => window.scrollTo({ top: 0, behavior: j.reduced ? 'auto' : 'smooth' }), [j.reduced])

  const current = selectedId ? snap.aircraft.find((a) => a.id === selectedId) ?? null : null
  // Remember the last known record so the panel can say "no longer in range" instead of vanishing.
  if (current && current !== lastSeen) setLastSeen(current)
  const shown = selectedId ? current ?? (lastSeen?.id === selectedId ? lastSeen : null) : null
  const close = useCallback(() => setSelectedId(null), [])

  return (
    <>
      <div className="graticule" aria-hidden="true" />
      <PlaneLayer {...j} />
      <SiteNav region={region} onRegion={goRegionAndScroll} onTop={top} />
      <main id="main">
        <section ref={heroRef} className="hero" id="top" data-scene-id="1" aria-label="Departure and takeoff">
          <div className="hero__pin">
            <div className="hero__stage" ref={markRef}>
              <WordMark morph={j.morph} reduced={j.reduced} identifiers={identifiers} regionLabel={REGIONS[region].label} />
            </div>
            <div className="hero__copy">
              <p className="eyebrow mono">
                <span className="swap swap--a">Scene 01 — Departure</span>
                <span className="swap swap--b">Scene 02 — Takeoff</span>
              </p>
              <p className="lede hero__lede">
                <span className="swap swap--a">A quiet instrument for watching real aircraft cross the sky.</span>
                <span className="swap swap--b">Every flight number is a name on a tail. The real ones are just below.</span>
              </p>
            </div>
            <a className="hero__cue mono" href="#inflight" onClick={(e) => { e.preventDefault(); scrollTo('inflight') }}>
              Scroll <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>
        <InFlight region={region} snap={snap} freshness={freshness} />
        <Airspace
          region={region}
          onRegion={goRegion}
          snap={snap}
          freshness={freshness}
          onRefresh={refresh}
          selectedId={selectedId}
          onOpen={setSelectedId}
        />
        <Arrival onTop={top} onAirspace={() => scrollTo('airspace')} />
      </main>
      <FlightDetail
        aircraft={shown}
        gone={Boolean(selectedId) && !current}
        live={shown ? isLive(shown, freshness === 'live') : false}
        reduced={j.reduced}
        onClose={close}
      />
    </>
  )
}
