import { Session } from '@contract'

const KEY = 'seatsure.session'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
type Listener = (session: Session | null) => void

/**
 * Access and refresh tokens, kept in localStorage so a reload stays signed in and every tab
 * shares one session. `get()` reads storage each time, so a token rotated by another tab is
 * used here too. Every storage access is guarded: once storage throws (private mode, blocked
 * site data), the session lives in memory for this tab only.
 */
export function createSessionStore(storage: () => Storage | undefined = () => globalThis.localStorage) {
  let memory: Session | null = null
  let memoryOnly = false
  const listeners = new Set<Listener>()

  function read(): Session | null {
    if (memoryOnly) return memory
    let raw: string | null
    try {
      const store = storage()
      if (!store) throw new Error('no storage')
      raw = store.getItem(KEY)
    } catch {
      memoryOnly = true
      return memory
    }
    if (!raw) return null
    try {
      const parsed = Session.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }

  function write(session: Session | null) {
    memory = session
    if (!memoryOnly) {
      try {
        const store = storage()
        if (!store) throw new Error('no storage')
        if (session) store.setItem(KEY, JSON.stringify(session))
        else store.removeItem(KEY)
      } catch {
        memoryOnly = true
      }
    }
    notify(session)
  }

  const notify = (session: Session | null) => listeners.forEach((listener) => listener(session))

  // Another tab signed in, out, or rotated the tokens. key null: that tab cleared all storage.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      const { key } = event as StorageEvent
      if (key === KEY || key === null) notify(read())
    })
  }

  return {
    get: read,
    set: (session: Session) => write(session),
    clear: () => write(null),
    subscribe(listener: Listener): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type SessionStore = ReturnType<typeof createSessionStore>

export const sessionStore = createSessionStore()
