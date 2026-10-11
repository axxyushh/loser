import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { motion, useTransform, type MotionValue } from 'motion/react'
import { FEATURED, type IdentifierSet } from '../lib/identifiers'

const A = ['T', 'H', 'E', ' ', 'L', 'O', 'S', 'E', 'R']
/** Target glyph for each slot of "THE LOSER"; null = the letter is dropped. */
const B: (string | null)[] = [null, null, null, null, 'L', 'O', '7', '0', '2']
const FONT = '"Instrument Serif"'

interface Metrics {
  /** Advance widths in em for A and B glyphs. */
  xA: number[]
  xB: number[]
  wA: number
  wB: number
}

function measureGlyphs(): Metrics {
  const ctx = document.createElement('canvas').getContext('2d')
  const w = (ch: string) => {
    if (!ctx) return 0.5
    ctx.font = `400 200px ${FONT}, serif`
    return ctx.measureText(ch).width / 200
  }
  const xA: number[] = []
  let cursor = 0
  for (const ch of A) {
    xA.push(cursor)
    cursor += w(ch)
  }
  const wA = cursor
  const bChars = B.filter((c): c is string => c !== null)
  const wB = bChars.reduce((s, c) => s + w(c), 0)
  const offset = (wA - wB) / 2
  const xB: number[] = []
  let c2 = offset
  for (const ch of B) {
    if (ch === null) {
      xB.push(0)
      continue
    }
    xB.push(c2)
    c2 += w(ch)
  }
  return { xA, xB, wA, wB }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const win = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)))

function Glyph({ i, m, morph }: { i: number; m: Metrics; morph: MotionValue<number> }) {
  const from = A[i] as string
  const to = B[i] ?? null
  const changes = to !== null && to !== from
  const moves = to !== null
  // Staggered windows: letters change one after another as the plane passes.
  const start = 0.18 + (i - 6) * 0.12
  const x = useTransform(morph, (t) => `${moves ? lerp(m.xA[i] ?? 0, m.xB[i] ?? 0, t) : (m.xA[i] ?? 0)}em`)
  const dropOpacity = useTransform(morph, (t) => 1 - win(t, 0, 0.5))
  const dropY = useTransform(morph, (t) => `${-0.14 * win(t, 0, 0.5)}em`)
  const outOpacity = useTransform(morph, (t) => 1 - win(t, start, start + 0.3))
  const outY = useTransform(morph, (t) => `${-0.32 * win(t, start, start + 0.3)}em`)
  const inOpacity = useTransform(morph, (t) => win(t, start + 0.1, start + 0.4))
  const inY = useTransform(morph, (t) => `${0.32 * (1 - win(t, start + 0.1, start + 0.4))}em`)

  if (from === ' ') return null
  if (!moves) {
    return (
      <motion.span className="wm__g" style={{ x, y: dropY, opacity: dropOpacity }}>
        {from}
      </motion.span>
    )
  }
  if (!changes) return <motion.span className="wm__g" style={{ x }}>{from}</motion.span>
  return (
    <motion.span className="wm__g" style={{ x }}>
      <motion.span className="wm__old" style={{ opacity: outOpacity, y: outY }}>{from}</motion.span>
      <motion.span className="wm__new" style={{ opacity: inOpacity, y: inY }}>{to}</motion.span>
    </motion.span>
  )
}

/** The settled LO702 word. Hover (mouse) cycles identifiers; tap/Enter advances. */
function FlightWord({ set, regionLabel }: { set: IdentifierSet; regionLabel: string }) {
  const [idx, setIdx] = useState(0)
  const hover = useRef<ReturnType<typeof setInterval> | null>(null)
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ids = set.ids
  const current = ids[idx % ids.length] ?? FEATURED

  const stop = () => {
    if (hover.current) clearInterval(hover.current)
    hover.current = null
  }
  useEffect(() => () => {
    stop()
    if (idle.current) clearTimeout(idle.current)
  }, [])

  const restoreSoon = () => {
    if (idle.current) clearTimeout(idle.current)
    idle.current = setTimeout(() => setIdx(0), 4500)
  }

  return (
    <div className="wm__settled">
      <button
        type="button"
        className="wm__word"
        aria-label={`Featured identifier ${FEATURED}. Activate to cycle through ${set.live ? 'callsigns from the live feed' : 'example identifiers'}. Currently ${current}.`}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse' || hover.current) return // ignore repeated enters
          setIdx((i) => i + 1)
          hover.current = setInterval(() => setIdx((i) => i + 1), 700)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return
          stop()
          setIdx(0)
        }}
        onClick={() => {
          if (hover.current) return // mouse users are already cycling
          setIdx((i) => i + 1)
          restoreSoon()
        }}
        onBlur={() => setIdx(0)}
      >
        {[...current].map((ch, i) => (
          <motion.span
            key={`${i}-${ch}`}
            className="wm__c"
            initial={idx === 0 ? false : { y: '0.38em', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.28, delay: i * 0.025, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {ch}
          </motion.span>
        ))}
      </button>
      <p className="wm__caption" aria-live="polite">
        {idx === 0 ? (
          <>LO702 is a featured name, not a tracked flight. Hover or tap to cycle.</>
        ) : set.live ? (
          <>{current} — a real callsign from the live {regionLabel} feed.</>
        ) : (
          <>{current} — illustrative identifier, not a live flight.</>
        )}
      </p>
    </div>
  )
}

interface Props {
  morph: MotionValue<number>
  reduced: boolean
  identifiers: IdentifierSet
  regionLabel: string
  onMetrics?: (wA: number) => void
}

export function WordMark({ morph, reduced, identifiers, regionLabel, onMetrics }: Props) {
  const [m, setM] = useState<Metrics | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      const next = measureGlyphs()
      setM(next)
      onMetrics?.(next.wA)
      // Let the journey re-measure the wordmark's on-screen box once it has its final width.
      requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('wm-measured'))))
    }
    if (document.fonts?.load) void document.fonts.load(`400 100px ${FONT}`).then(run, run)
    else run()
    return () => {
      cancelled = true
    }
  }, [onMetrics])

  // Boolean snapshot of the morph: React re-renders only when it flips, never per frame.
  const settled = useSyncExternalStore(
    (cb) => morph.on('change', cb),
    () => (reduced ? morph.get() >= 0.5 : morph.get() >= 0.999),
    () => false,
  )

  const glyphs = useMemo(() => (m ? A.map((_, i) => <Glyph key={i} i={i} m={m} morph={morph} />) : null), [m, morph])

  return (
    <div className="wm" style={m ? ({ '--wa': m.wA } as React.CSSProperties) : undefined}>
      <h1 className="sr-only">THE LOSER</h1>
      <div className={`wm__row${m ? ' is-ready' : ''}`} aria-hidden={settled ? undefined : true}>
        {reduced ? (
          <>
            <span className={`wm__flat${settled ? ' is-off' : ''}`} aria-hidden="true">THE LOSER</span>
            {settled && <FlightWord set={identifiers} regionLabel={regionLabel} />}
          </>
        ) : settled ? (
          <FlightWord set={identifiers} regionLabel={regionLabel} />
        ) : (
          <div className="wm__glyphs" aria-hidden="true">{glyphs}</div>
        )}
      </div>
    </div>
  )
}
