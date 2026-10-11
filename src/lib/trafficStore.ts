import { FeedError, fetchPoint } from './adsbClient'
import { mergeForRegion } from './normalize'
import { MAX_RADIUS_NM, REGIONS } from './regions'
import type { RegionId, RegionSnapshot } from './types'

export const REFRESH_MS = 60_000
/** A region is "stale" when its last good data is older than this. */
export const STALE_AFTER_MS = REFRESH_MS * 2.5
const MAX_BACKOFF_MS = 5 * 60_000
const CONCURRENCY = 3

type Listener = () => void

const emptySnapshot = (id: RegionId): RegionSnapshot => ({
  status: 'idle',
  aircraft: [],
  total: 0,
  lastSuccessAt: null,
  error: null,
  refreshing: false,
  failedSeeds: 0,
  seedCount: REGIONS[id].seeds.length,
  nextAttemptAt: null,
  failures: 0,
})

/**
 * Framework-agnostic live-data store.
 *  - only the active region is polled; others keep their last result
 *  - one in-flight refresh per region (no duplicate simultaneous requests)
 *  - polling pauses while the tab is hidden and catches up on return
 *  - failures keep the previous aircraft (marked stale by consumers) and back off
 */
export class TrafficStore {
  private snaps: Record<RegionId, RegionSnapshot> = {
    eu: emptySnapshot('eu'),
    usa: emptySnapshot('usa'),
    asia: emptySnapshot('asia'),
  }
  private listeners = new Set<Listener>()
  private active: RegionId = 'eu'
  private enabled = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private inflight = new Map<RegionId, AbortController>()
  private visibilityBound = false

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  get = (id: RegionId): RegionSnapshot => this.snaps[id]

  private set(id: RegionId, patch: Partial<RegionSnapshot>): void {
    this.snaps = { ...this.snaps, [id]: { ...this.snaps[id], ...patch } }
    this.listeners.forEach((l) => l())
  }

  /** Start/stop network activity (e.g. only once the tracker nears the viewport). */
  setEnabled(on: boolean): void {
    if (on === this.enabled) return
    this.enabled = on
    if (on) {
      this.bindVisibility()
      this.kick()
    } else {
      this.clearTimer()
    }
  }

  setActive(id: RegionId): void {
    if (id === this.active) return
    this.active = id
    this.clearTimer()
    if (!this.enabled) return
    const s = this.snaps[id]
    const fresh = s.lastSuccessAt !== null && Date.now() - s.lastSuccessAt < REFRESH_MS / 2
    if (fresh) this.schedule(REFRESH_MS - (Date.now() - (s.lastSuccessAt ?? 0)))
    else void this.refresh(id)
  }

  /** Manual refresh. Ignored while a request for that region is already running. */
  refreshNow(): void {
    this.clearTimer()
    void this.refresh(this.active, true)
  }

  private kick(): void {
    const s = this.snaps[this.active]
    const due = s.lastSuccessAt === null || Date.now() - s.lastSuccessAt >= REFRESH_MS
    if (due) void this.refresh(this.active)
    else this.schedule(REFRESH_MS - (Date.now() - (s.lastSuccessAt ?? 0)))
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return
    this.visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearTimer()
      else if (this.enabled) this.kick()
    })
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.snaps[this.active].nextAttemptAt !== null) this.set(this.active, { nextAttemptAt: null })
  }

  private schedule(ms: number): void {
    if (typeof document !== 'undefined' && document.hidden) return
    this.clearTimer()
    const delay = Math.max(1_000, ms)
    this.set(this.active, { nextAttemptAt: Date.now() + delay })
    this.timer = setTimeout(() => {
      this.timer = null
      if (this.enabled) void this.refresh(this.active)
    }, delay)
  }

  private async refresh(id: RegionId, manual = false): Promise<void> {
    if (this.inflight.has(id)) return
    const ctl = new AbortController()
    this.inflight.set(id, ctl)
    const region = REGIONS[id]
    const first = this.snaps[id].lastSuccessAt === null
    this.set(id, { refreshing: true, status: first ? 'loading' : this.snaps[id].status, nextAttemptAt: null })

    const results: Awaited<ReturnType<typeof fetchPoint>>[] = []
    let failed = 0
    let lastErr: FeedError | null = null
    let cursor = 0
    const worker = async () => {
      while (cursor < region.seeds.length && !ctl.signal.aborted) {
        const seed = region.seeds[cursor++]
        if (!seed) break
        try {
          results.push(await fetchPoint(seed.lat, seed.lon, MAX_RADIUS_NM, ctl.signal))
        } catch (e) {
          failed++
          lastErr = e instanceof FeedError ? e : new FeedError('Could not reach the data source')
          // Stop hammering a rate-limited or erroring source.
          if (lastErr.status === 429 || (lastErr.status ?? 0) >= 500) cursor = region.seeds.length
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    this.inflight.delete(id)

    if (results.length === 0) {
      const failures = this.snaps[id].failures + 1
      const err = lastErr as FeedError | null
      const backoff = Math.min(
        err?.retryAfterMs ?? REFRESH_MS * 2 ** Math.min(failures - 1, 3),
        MAX_BACKOFF_MS,
      )
      this.set(id, {
        refreshing: false,
        failures,
        error: err?.message ?? 'Data temporarily unavailable',
        // Keep previous aircraft. If we never had any, surface the error state.
        status: this.snaps[id].lastSuccessAt === null ? 'error' : this.snaps[id].status,
      })
      if (this.enabled && id === this.active) this.schedule(backoff)
      return
    }

    const aircraft = mergeForRegion(results.map((r) => r.aircraft), region)
    this.set(id, {
      status: aircraft.length ? 'ready' : 'empty',
      aircraft,
      total: aircraft.length,
      lastSuccessAt: Date.now(),
      error: null,
      refreshing: false,
      failedSeeds: failed,
      failures: 0,
    })
    if (this.enabled && id === this.active) this.schedule(manual ? REFRESH_MS : REFRESH_MS)
  }
}

export const trafficStore = new TrafficStore()
