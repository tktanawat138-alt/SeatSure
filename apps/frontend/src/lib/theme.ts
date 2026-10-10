export const THEME_KEY = 'seatsure-theme'
export const THEME_CHOICES = ['light', 'dark', 'system'] as const

export type ThemeChoice = (typeof THEME_CHOICES)[number]
export type ResolvedTheme = 'light' | 'dark'
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

const isChoice = (value: unknown): value is ThemeChoice => THEME_CHOICES.includes(value as ThemeChoice)

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light'
  return choice
}

/** The saved choice, or `system` when nothing valid is saved or the storage throws. */
export function readStoredTheme(storage: ThemeStorage): ThemeChoice {
  try {
    const value = storage.getItem(THEME_KEY)
    return isChoice(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(storage: ThemeStorage, choice: ThemeChoice): void {
  try {
    storage.setItem(THEME_KEY, choice)
  } catch {
    // Private window or blocked site data: the choice lasts for this page view only.
  }
}

/**
 * Storage that never throws. It uses the real one while that works and keeps the last value in
 * memory otherwise, so the choice still holds until the page is reloaded.
 */
export function createThemeStorage(getStorage: () => ThemeStorage): ThemeStorage {
  const memory = new Map<string, string>()
  return {
    getItem(key) {
      try {
        const value = getStorage().getItem(key)
        if (value !== null) return value
      } catch {
        // fall through to memory
      }
      return memory.get(key) ?? null
    },
    setItem(key, value) {
      memory.set(key, value)
      try {
        getStorage().setItem(key, value)
      } catch {
        // memory already holds it
      }
    },
  }
}

export function applyTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.classList.toggle('dark', theme === 'dark')
}
