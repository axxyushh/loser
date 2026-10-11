import { motion } from 'motion/react'
import type { Journey } from '../hooks/useJourney'
import { Airliner } from './Airliner'

type Props = Pick<Journey, 'reduced' | 'box' | 'x' | 'y' | 'rotate' | 'scale' | 'opacity' | 'pathRef' | 'trailRef'>

/**
 * Fixed, non-interactive layer carrying the route trail and the plane. It never
 * receives pointer events, so it cannot block cards or controls. `data-scene`
 * on <html> drops the plane behind the content while the card grid is on screen.
 */
export function PlaneLayer({ reduced, box, x, y, rotate, scale, opacity, pathRef, trailRef }: Props) {
  return (
    <>
      {!reduced && box.d && (
        <svg className="route" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true" focusable="false">
          <path ref={pathRef} d={box.d} className="route__plan" />
          <path ref={trailRef} d={box.d} className="route__flown" />
        </svg>
      )}
      <motion.div className="plane" aria-hidden="true" style={{ x, y, rotate, scale, opacity }}>
        <Airliner className="plane__svg" />
      </motion.div>
    </>
  )
}
