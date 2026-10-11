import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { STALE_AFTER_MS, trafficStore } from '../lib/trafficStore'
import type { RegionId, RegionSnapshot } from '../lib/types'

export type Freshness = 'live' | 'stale' | 'none'

function computeFreshness(snap: RegionSnapshot): Freshness {
  if (snap.lastSuccessAt === null) return 'none'
  if (snap.error || Date.now() - snap.lastSuccessAt > STALE_AFTER_MS) return 'stale'
  return 'live'
}

/**
 * Subscribes to the traffic store for `region`. `freshness` is a primitive that is
 * re-evaluated every second, so React only re-renders the grid when it actually flips.
 */
export function useTraffic(region: RegionId, enabled: boolean) {
  const snap: RegionSnapshot = useSyncExternalStore(trafficStore.subscribe, () => trafficStore.get(region))
  const freshness = useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 1000)
      const off = trafficStore.subscribe(cb)
      return () => {
        clearInterval(t)
        off()
      }
    },
    () => computeFreshness(trafficStore.get(region)),
    (): Freshness => 'none',
  )

  useEffect(() => { trafficStore.setActive(region) }, [region])
  useEffect(() => { trafficStore.setEnabled(enabled) }, [enabled])

  const refresh = useCallback(() => trafficStore.refreshNow(), [])
  return { snap, freshness, refresh }
}
