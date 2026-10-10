import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createThemeStorage,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  THEME_KEY,
  type ThemeStorage,
} from '@/lib/theme'

const throwing: ThemeStorage = {
  getItem() {
    throw new DOMException('denied', 'SecurityError')
  },
  setItem() {
    throw new DOMException('denied', 'SecurityError')
  },
}

function memory(initial: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => void (data[key] = value),
  }
}

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('%s with prefersDark=%s is %s', (choice, prefersDark, expected) => {
    expect(resolveTheme(choice, prefersDark)).toBe(expected)
  })
})

describe('readStoredTheme', () => {
  it('uses the key seatsure-theme', () => {
    expect(THEME_KEY).toBe('seatsure-theme')
  })

  it.each(['light', 'dark', 'system'] as const)('returns a stored %s', (choice) => {
    expect(readStoredTheme(memory({ [THEME_KEY]: choice }))).toBe(choice)
  })

  it('defaults to system when nothing is stored', () => {
    expect(readStoredTheme(memory())).toBe('system')
  })

  it.each(['', 'Dark', 'blue', '{"theme":"dark"}', 'undefined'])('ignores garbage %j', (garbage) => {
    expect(readStoredTheme(memory({ [THEME_KEY]: garbage }))).toBe('system')
  })

  it('survives a storage that throws', () => {
    expect(readStoredTheme(throwing)).toBe('system')
  })
})

describe('storeTheme', () => {
  it('writes the choice under seatsure-theme', () => {
    const storage = memory()
    storeTheme(storage, 'dark')
    expect(storage.data[THEME_KEY]).toBe('dark')
  })

  it('survives a storage that throws', () => {
    expect(() => storeTheme(throwing, 'dark')).not.toThrow()
  })
})

describe('createThemeStorage', () => {
  it('uses the real storage when it works', () => {
    const real = memory()
    const storage = createThemeStorage(() => real)
    storeTheme(storage, 'dark')
    expect(real.data[THEME_KEY]).toBe('dark')
    expect(readStoredTheme(storage)).toBe('dark')
  })

  it('keeps the choice in memory when reading the storage object itself throws', () => {
    const storage = createThemeStorage(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(readStoredTheme(storage)).toBe('system')
    storeTheme(storage, 'dark')
    expect(readStoredTheme(storage)).toBe('dark')
  })

  it('keeps the choice in memory when writes throw', () => {
    const storage = createThemeStorage(() => throwing)
    storeTheme(storage, 'light')
    expect(readStoredTheme(storage)).toBe('light')
  })
})

// index.html sets the class before React loads; it must agree with resolveTheme.
describe('the inline script in index.html', () => {
  const html = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8')
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

  function run(stored: string | 'throws' | null, prefersDark: boolean): boolean {
    const classes = new Set<string>()
    const localStorage = {
      getItem() {
        if (stored === 'throws') throw new Error('denied')
        return stored
      },
    }
    new Function('localStorage', 'matchMedia', 'document', script)(
      localStorage,
      () => ({ matches: prefersDark }),
      { documentElement: { classList: { add: (c: string) => classes.add(c) } } },
    )
    return classes.has('dark')
  }

  it('exists', () => {
    expect(script.length).toBeGreaterThan(0)
  })

  it.each([
    ['light', true, false],
    ['dark', false, true],
    [null, true, true],
    [null, false, false],
    ['garbage', true, true],
    ['throws', true, true],
    ['throws', false, false],
  ] as const)('stored=%s prefersDark=%s gives dark=%s', (stored, prefersDark, dark) => {
    expect(run(stored, prefersDark)).toBe(dark)
    const choice = stored === 'throws' || stored === null ? 'system' : stored === 'garbage' ? 'system' : stored
    expect(resolveTheme(choice, prefersDark) === 'dark').toBe(dark)
  })
})
