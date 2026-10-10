import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  createThemeStorage,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  type ResolvedTheme,
  type ThemeChoice,
} from '@/lib/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const storage = createThemeStorage(() => window.localStorage)

type ThemeValue = { choice: ThemeChoice; resolved: ResolvedTheme; setChoice: (choice: ThemeChoice) => void }

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [choice, setChoiceState] = useState(() => readStoredTheme(storage))
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches)
  const resolved = resolveTheme(choice, prefersDark)

  // Follow the operating system live; it only matters while the choice is `system`.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    setPrefersDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => applyTheme(document.documentElement, resolved), [resolved])

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    storeTheme(storage, next)
  }, [])

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice])
  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeValue {
  const value = use(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}
