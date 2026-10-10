import { useEffect, useRef } from 'react'

export const AUTO_REFRESH_INTERVAL_MS = 15_000

export interface AutoRefreshOptions {
  /** Time between ticks. */
  intervalMs: number
  /** Whether the page is visible right now. A tick refreshes even when hidden; only a return to visible adds a refresh. */
  isVisible: () => boolean
  /** Subscribe to visibility changes; returns the unsubscribe function. */
  onVisibilityChange: (listener: () => void) => () => void
}

/**
 * Timer logic behind `useAutoRefresh`, free of React and the DOM so it can be tested with fake timers.
 * Calls `refresh` every `intervalMs` and whenever visibility changes to visible. A call is skipped while the
 * previous one is still pending, and a refresh that throws or rejects is swallowed so later ticks still run.
 * `dispose()` clears the interval and the visibility subscription.
 */
export function createAutoRefresh(refresh: () => void | Promise<void>, options: AutoRefreshOptions) {
  let running = false
  const run = () => {
    if (running) return
    let pending: void | Promise<void>
    try {
      pending = refresh()
    } catch {
      return // the caller reports its own failures; a failed refresh must not stop the next tick
    }
    if (!pending) return
    running = true
    void pending.catch(() => {}).finally(() => (running = false))
  }
  const interval = setInterval(run, options.intervalMs)
  const unsubscribe = options.onVisibilityChange(() => {
    if (options.isVisible()) run()
  })
  return {
    dispose() {
      clearInterval(interval)
      unsubscribe()
    },
  }
}

/** Refresh visible data every 15 s and when the tab becomes visible again. Always calls the latest `refresh`. */
export function useAutoRefresh(refresh: () => void | Promise<void>) {
  const latest = useRef(refresh)
  useEffect(() => {
    latest.current = refresh
  })
  useEffect(() => {
    const { dispose } = createAutoRefresh(() => latest.current(), {
      intervalMs: AUTO_REFRESH_INTERVAL_MS,
      isVisible: () => document.visibilityState === 'visible',
      onVisibilityChange: (listener) => {
        document.addEventListener('visibilitychange', listener)
        return () => document.removeEventListener('visibilitychange', listener)
      },
    })
    return dispose
  }, [])
}
