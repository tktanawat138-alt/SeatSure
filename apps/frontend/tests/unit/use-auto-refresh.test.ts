import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTO_REFRESH_INTERVAL_MS, createAutoRefresh } from '@/lib/use-auto-refresh'

// A fake document: `setVisible` flips visibility and notifies the listener the way `visibilitychange` does.
function fakeDocument(initiallyVisible = true) {
  let visible = initiallyVisible
  const listeners = new Set<() => void>()
  return {
    isVisible: () => visible,
    onVisibilityChange: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setVisible(next: boolean) {
      visible = next
      for (const listener of [...listeners]) listener()
    },
    listenerCount: () => listeners.size,
  }
}

describe('createAutoRefresh', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('refreshes every 15 seconds', () => {
    const refresh = vi.fn()
    const doc = fakeDocument()
    createAutoRefresh(refresh, { intervalMs: AUTO_REFRESH_INTERVAL_MS, ...doc })
    expect(AUTO_REFRESH_INTERVAL_MS).toBe(15_000)
    vi.advanceTimersByTime(14_999)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30_000)
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('refreshes when the document becomes visible, not when it turns hidden', () => {
    const refresh = vi.fn()
    const doc = fakeDocument()
    createAutoRefresh(refresh, { intervalMs: 15_000, ...doc })
    doc.setVisible(false)
    expect(refresh).not.toHaveBeenCalled()
    doc.setVisible(true)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not stack a call while the previous refresh is still pending', async () => {
    let finish: () => void = () => {}
    const refresh = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const doc = fakeDocument()
    createAutoRefresh(refresh, { intervalMs: 15_000, ...doc })
    vi.advanceTimersByTime(15_000)
    vi.advanceTimersByTime(15_000)
    doc.setVisible(false)
    doc.setVisible(true)
    expect(refresh).toHaveBeenCalledTimes(1)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    vi.advanceTimersByTime(15_000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('stops ticking and listening after dispose', () => {
    const refresh = vi.fn()
    const doc = fakeDocument()
    const { dispose } = createAutoRefresh(refresh, { intervalMs: 15_000, ...doc })
    dispose()
    expect(doc.listenerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    doc.setVisible(false)
    doc.setVisible(true)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps ticking after a refresh that throws or rejects, with no unhandled rejection', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const refresh = vi
        .fn<() => void | Promise<void>>()
        .mockImplementationOnce(() => {
          throw new Error('sync boom')
        })
        .mockImplementationOnce(() => Promise.reject(new Error('async boom')))
        .mockImplementation(() => undefined)
      const doc = fakeDocument()
      createAutoRefresh(refresh, { intervalMs: 15_000, ...doc })
      await vi.advanceTimersByTimeAsync(15_000)
      await vi.advanceTimersByTimeAsync(15_000)
      await vi.advanceTimersByTimeAsync(15_000)
      expect(refresh).toHaveBeenCalledTimes(3)
      vi.useRealTimers()
      await new Promise((resolve) => setImmediate(resolve))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})
