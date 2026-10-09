import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/** Refresh visible data from realtime events, with polling for changes hidden by row-level security. */
export function useAutoRefresh(refresh: () => void | Promise<void>, ...tables: string[]) {
  useEffect(() => {
    let debounce: number | undefined
    const scheduleRefresh = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => void refresh(), 250)
    }
    const channel = supabase.channel(`auto-refresh:${tables.join(',')}`)
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh)
    }
    channel.subscribe()

    const interval = window.setInterval(() => void refresh(), 15_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearTimeout(debounce)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [refresh, ...tables])
}
