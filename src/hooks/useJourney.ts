import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMotionValue, useMotionValueEvent, useScroll, type MotionValue } from 'motion/react'
import { buildPath, smoothstep } from '../lib/flightPath'
import { useMedia, usePrefersReducedMotion } from './useMedia'

export interface Journey {
  reduced: boolean
  /** Fixed-layer pixel size the path was composed for. */
  box: { w: number; h: number; d: string }
  x: MotionValue<number>
  y: MotionValue<number>
  rotate: MotionValue<number>
  scale: MotionValue<number>
  opacity: MotionValue<number>
  /** 0 = THE LOSER, 1 = LO702. Driven by the plane's position on its path. */
  morph: MotionValue<number>
  pathRef: React.RefObject<SVGPathElement | null>
  trailRef: React.RefObject<SVGPathElement | null>
}

interface Metrics {
  total: number
  heroFrac: number
  uA: number
  uB: number
  heroLen: number
  docMax: number
}

/**
 * Scroll → plane position. Scroll distance is split in two: the pinned hero
 * (departure + takeoff) maps to the first stretch of the route, everything
 * after it maps to the remainder. Only motion values are written per frame,
 * so React never re-renders while scrolling.
 */
export function useJourney(
  heroRef: React.RefObject<HTMLElement | null>,
  markRef: React.RefObject<HTMLElement | null>,
): Journey {
  const reduced = usePrefersReducedMotion()
  const mobile = useMedia('(max-width: 719px)')
  const { scrollY } = useScroll()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useMotionValue(0)
  const scale = useMotionValue(1)
  const opacity = useMotionValue(0) // hidden until the first position is computed
  const morph = useMotionValue(0)
  const pathRef = useRef<SVGPathElement | null>(null)
  const trailRef = useRef<SVGPathElement | null>(null)
  const metrics = useRef<Metrics | null>(null)
  const [size, setSize] = useState(() => ({ w: document.documentElement.clientWidth, h: window.innerHeight }))
  // The route is a pure function of viewport size and class, so it is derived, not stored.
  const box = useMemo(() => ({ ...size, d: buildPath(size.w, size.h, mobile) }), [size, mobile])

  const update = useCallback(() => {
    const sy = scrollY.get()
    const vh = window.innerHeight
    if (reduced) {
      morph.set(sy > vh * 0.45 ? 1 : 0)
      opacity.set(sy > vh * 0.6 ? 0 : 1)
      return
    }
    const path = pathRef.current
    const m = metrics.current
    if (!path || !m || m.total === 0) return
    const hero = Math.max(1, m.heroLen)
    const rest = Math.max(1, m.docMax - m.heroLen)
    const u = sy <= hero ? (sy / hero) * m.heroFrac : m.heroFrac + ((sy - hero) / rest) * (1 - m.heroFrac)
    const s = Math.min(1, Math.max(0, u)) * m.total
    const p = path.getPointAtLength(s)
    // Tangent from a short look-ahead (look-behind at the very end of the route).
    const a = path.getPointAtLength(Math.min(m.total, s + 3))
    const b = path.getPointAtLength(Math.max(0, s - 3))
    const [ax, ay] = s + 3 <= m.total ? [a.x - p.x, a.y - p.y] : [p.x - b.x, p.y - b.y]
    x.set(p.x)
    y.set(p.y)
    rotate.set((Math.atan2(ay, ax) * 180) / Math.PI)
    // Landing: shrink slightly over the last stretch of the route.
    scale.set(1 - 0.22 * smoothstep((u - 0.9) / 0.1))
    opacity.set(1)
    morph.set(smoothstep((u - m.uA) / Math.max(0.0001, m.uB - m.uA)))
    trailRef.current?.style.setProperty('stroke-dashoffset', String(m.total * (1 - u)))
  }, [scrollY, reduced, x, y, rotate, scale, opacity, morph])

  // Track viewport size. Small height changes (mobile browser toolbars) are ignored on purpose.
  useEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const w = document.documentElement.clientWidth
        const h = window.innerHeight
        setSize((prev) => (prev.w === w && Math.abs(prev.h - h) < 120 ? prev : { w, h }))
      })
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Measure the path and the layout once the new path is in the DOM.
  useEffect(() => {
    const measure = () => {
      const path = pathRef.current
      if (!path || !box.d) return
      const total = path.getTotalLength()
      const markEl = markRef.current?.querySelector('.wm__row') ?? markRef.current
      const mark = markEl?.getBoundingClientRect()
      const aX = mark ? mark.left + mark.width * 0.2 : box.w * 0.3
      const bX = mark ? mark.left + mark.width * 0.78 : box.w * 0.7
      // The hero stretch ends where the route first reaches its right-hand apex.
      let heroS = total * 0.2
      let sa = -1
      let sb = -1
      const N = 600
      for (let i = 0; i <= N; i++) {
        const s = (i / N) * total
        const px = path.getPointAtLength(s).x
        if (sa < 0 && px >= aX) sa = s
        if (sb < 0 && px >= bX) sb = s
        if (px >= box.w * (mobile ? 0.93 : 0.94)) {
          heroS = s
          break
        }
      }
      const heroFrac = heroS / total
      const uA = sa >= 0 ? sa / total : heroFrac * 0.4
      const uB = sb >= 0 ? sb / total : heroFrac * 0.7
      const hero = heroRef.current
      const heroLen = hero ? Math.max(1, hero.offsetHeight - window.innerHeight) : 1
      const docMax = Math.max(heroLen + 1, document.documentElement.scrollHeight - window.innerHeight)
      metrics.current = { total, heroFrac, uA, uB, heroLen, docMax }
      trailRef.current?.style.setProperty('stroke-dasharray', String(total))
      update()
    }
    measure()
    // Content height changes as aircraft load: re-measure without jumping the plane much.
    const ro = new ResizeObserver(() => measure())
    ro.observe(document.body)
    // The wordmark announces itself once its glyph widths are known.
    window.addEventListener('wm-measured', measure)
    if (typeof document !== 'undefined' && document.fonts) void document.fonts.ready.then(measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('wm-measured', measure)
    }
  }, [box, mobile, heroRef, markRef, update])

  useMotionValueEvent(scrollY, 'change', update)

  // Reduced motion: park the plane statically in the hero; morph is a simple threshold.
  useEffect(() => {
    if (!reduced) return
    x.set(box.w * (mobile ? 0.82 : 0.9))
    y.set(box.h * 0.2)
    rotate.set(-10)
    scale.set(1)
    update()
  }, [reduced, box, mobile, x, y, rotate, scale, update])


  return { reduced, box, x, y, rotate, scale, opacity, morph, pathRef, trailRef }
}
