import { useSyncExternalStore } from 'react'

/** One shared 1 Hz clock so many small "x seconds ago" labels cost a single timer. */
let current = Date.now()
const subs = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(cb: () => void): () => void {
  subs.add(cb)
  current = Date.now()
  if (!timer) {
    timer = setInterval(() => {
      current = Date.now()
      subs.forEach((f) => f())
    }, 1000)
  }
  return () => {
    subs.delete(cb)
    if (subs.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

export const useNow = (): number => useSyncExternalStore(subscribe, () => current, () => current)
