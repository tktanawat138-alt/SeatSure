import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { currentSession, loadMe, onSessionChange, signOut } from '@/app/deps'
import type { CurrentUser } from '@/entities/current-user'
import { DomainError } from '@/entities/domain-error'

// Same field names the pages read since the supabase-js version: session.user.{id,email}, profile.{id,full_name,role}.
export interface AuthSession {
  user: { id: string; email: string }
}

export interface AuthProfile {
  id: string
  full_name: string
  role: CurrentUser['role']
}

interface AuthState {
  session: AuthSession | null
  profile: AuthProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, profile: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => currentSession()?.accessToken ?? null)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => onSessionChange((next) => setToken(next?.accessToken ?? null)), [])

  useEffect(() => {
    if (token === null) {
      setUser(null)
      setFailed(false)
      return
    }
    let cancelled = false
    loadMe().then(
      (me) => {
        if (cancelled) return
        setUser(me)
        setFailed(false)
      },
      (error: unknown) => {
        if (cancelled) return
        // A saved session the API no longer accepts (e.g. after a database reset).
        if (error instanceof DomainError && error.code === 'not_authenticated') void signOut()
        // API unreachable: show the login page but keep the tokens for the next reload.
        else setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [token])

  const value = useMemo<AuthState>(
    () => ({
      session: user ? { user: { id: user.id, email: user.email } } : null,
      profile: user ? { id: user.id, full_name: user.fullName, role: user.role } : null,
      loading: token !== null && user === null && !failed,
    }),
    [user, token, failed],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
