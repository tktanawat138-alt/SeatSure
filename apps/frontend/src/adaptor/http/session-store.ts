import { Session } from '@contract'

const KEY = 'seatsure.session'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
type Listener = (session: Session | null) => void

/**
 * Access and refresh tokens, kept in localStorage so a reload stays signed in. Every storage
 * access is guarded: private mode or blocked storage can throw, and then the session lives in
 * memory for this tab only.
 */
export function createSessionStore(storage: () => Storage | undefined = () => globalThis.localStorage) {
  let current: Session | null | undefined // undefined: not read from storage yet
  const listeners = new Set<Listener>()

  function read(): Session | null {
    try {
      const raw = storage()?.getItem(KEY)
      if (!raw) return null
      const parsed = Session.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }

  function write(session: Session | null) {
    current = session
    try {
      if (session) storage()?.setItem(KEY, JSON.stringify(session))
      else storage()?.removeItem(KEY)
    } catch {
      // Memory still holds it.
    }
    listeners.forEach((listener) => listener(session))
  }

  return {
    get(): Session | null {
      if (current === undefined) current = read()
      return current
    },
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
