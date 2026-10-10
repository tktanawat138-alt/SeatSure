import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WCAG 2.x contrast of the design tokens in src/index.css, in both themes.
// Body text needs 4.5:1, UI boundaries and focus indicators 3:1.

const css = readFileSync(join(import.meta.dirname, '../../src/index.css'), 'utf8')

type Rgb = [number, number, number]

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const body = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

const light = block(':root')
const dark = { ...light, ...block('.dark') }

const toSrgb = (c: number) => {
  const v = Math.min(1, Math.max(0, c))
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
}

function oklch(value: string): { rgb: Rgb; alpha: number } {
  const m = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)/.exec(value)
  if (!m) throw new Error(`cannot parse ${value}`)
  const [L, C, h] = [parseFloat(m[1]) / (m[1].endsWith('%') ? 100 : 1), Number(m[2]), (Number(m[3]) * Math.PI) / 180]
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb: Rgb = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ].map(toSrgb) as Rgb
  const alpha = m[4] === undefined ? 1 : m[5] ? Number(m[4]) / 100 : Number(m[4])
  return { rgb, alpha }
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

/** Colour of a token over a backdrop token (alpha tokens are composited). */
function resolve(tokens: Record<string, string>, name: string, over?: string, alphaOverride?: number): Rgb {
  const { rgb, alpha } = oklch(tokens[name])
  const a = alphaOverride ?? alpha
  if (a === 1) return rgb
  const back = resolve(tokens, over ?? 'background')
  return rgb.map((c, i) => c * a + back[i] * (1 - a)) as Rgb
}

function ratio(tokens: Record<string, string>, fg: string, bg: string, fgAlpha?: number): number {
  const back = resolve(tokens, bg)
  const front = resolve(tokens, fg, bg, fgAlpha)
  const [hi, lo] = [luminance(front), luminance(back)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [foreground token, background token, minimum ratio, foreground alpha]
const pairs: [string, string, number, number?][] = [
  ['foreground', 'background', 4.5],
  ['card-foreground', 'card', 4.5],
  ['popover-foreground', 'popover', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary', 3, 0.7], // brand panel headline, large text
  ['primary-foreground', 'primary', 4.5, 0.8],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['destructive', 'background', 4.5],
  ['destructive', 'card', 4.5],
  ['primary', 'background', 4.5], // links and avatar initials
  ['primary', 'card', 4.5],
  ['ring', 'background', 3], // focus indicator
  ['ring', 'card', 3],
]

describe.each([
  ['dark', dark],
  ['light', light],
] as const)('%s theme contrast', (_name, tokens) => {
  it.each(pairs)('%s on %s is at least %s:1 (fg alpha %s)', (fg, bg, min, alpha) => {
    expect(ratio(tokens, fg, bg, alpha)).toBeGreaterThanOrEqual(min)
  })
})

describe('dark theme', () => {
  it('defines every token the light theme defines', () => {
    const missing = Object.keys(light).filter((key) => !(key in block('.dark')) && key !== 'radius')
    expect(missing).toEqual([])
  })

  it('keeps form control borders at 3:1 against the page and cards', () => {
    expect(ratio(dark, 'input', 'background')).toBeGreaterThanOrEqual(3)
    expect(ratio(dark, 'input', 'card')).toBeGreaterThanOrEqual(3)
  })
})

// Status badges and the roster warning use raw Tailwind palette colours (src/components/status-badge.styles.ts).
const theme = readFileSync(join(import.meta.dirname, '../../node_modules/tailwindcss/theme.css'), 'utf8')
const palette = (name: string) => {
  const value = new RegExp(`--color-${name}: (oklch\\([^)]*\\));`).exec(theme)?.[1]
  if (!value) throw new Error(`no ${name} in tailwind theme`)
  return value
}
const status = (fg: string, bg: string) => ratio({ f: palette(fg), b: palette(bg), background: 'oklch(1 0 0)' }, 'f', 'b')

describe('status colours', () => {
  it.each([
    ['light ok', 'emerald-700', 'emerald-50'],
    ['light warn', 'amber-800', 'amber-50'],
    ['light bad', 'red-700', 'red-50'],
    ['dark ok', 'emerald-300', 'emerald-950'],
    ['dark warn', 'amber-300', 'amber-950'],
    ['dark bad', 'red-300', 'red-950'],
  ])('%s text is at least 4.5:1 (%s on %s)', (_label, fg, bg) => {
    expect(status(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the roster warning text readable on the dark card', () => {
    expect(ratio({ ...dark, f: palette('amber-300') }, 'f', 'card')).toBeGreaterThanOrEqual(4.5)
  })
})
