import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../../src')

function files(dir: string, match: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path, match) : match(path) ? [path] : []
  })
}

const sources = files(
  SRC,
  (path) => path.endsWith('.styles.ts') || (path.includes('/components/ui/') && path.endsWith('.tsx')),
)

// Raw palette families. Each light-mode utility on one of them needs a dark: sibling for the
// same property (bg, text, border, ring, fill, stroke) in the same string.
const raw = /^(?:[^\s:]+:)*(bg|text|border|ring|fill|stroke)-(?:emerald|amber|red|green|yellow|orange|blue|sky|slate|gray|zinc|neutral|stone)-\d{2,3}/
const darkProperty = /^dark:(?:[^\s:]+:)*(bg|text|border|ring|fill|stroke)-/

/** Every quoted string in a source file (single, double, or backtick, no interpolation). */
function strings(source: string): string[] {
  return [...source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`$]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '')
}

describe('raw palette colours work in dark mode', () => {
  it('finds the style files to scan', () => {
    expect(sources.length).toBeGreaterThan(10)
  })

  it('has a dark: sibling for every raw palette colour utility in the same string', () => {
    const missing: string[] = []
    for (const file of sources) {
      for (const text of strings(readFileSync(file, 'utf8'))) {
        const tokens = text.split(/\s+/)
        const dark = new Set(tokens.map((t) => darkProperty.exec(t)?.[1]))
        for (const token of tokens) {
          if (token.startsWith('dark:')) continue
          const match = raw.exec(token)
          if (match && !dark.has(match[1])) {
            missing.push(`${relative(SRC, file)}: "${token}" has no dark:${match[1]}-* sibling in "${text}"`)
          }
        }
      }
    }
    expect(missing, `Add a dark: variant next to each raw colour:\n${missing.join('\n')}`).toEqual([])
  })

  it('does not hard-code white or black text and background outside overlays', () => {
    const offenders: string[] = []
    for (const file of sources) {
      for (const text of strings(readFileSync(file, 'utf8'))) {
        for (const token of text.split(/\s+/)) {
          if (token.startsWith('dark:')) continue
          // bg-black/10 modal scrims are the same dim layer in both themes.
          if (/^(?:bg-black\/\d+|[a-z-]+:bg-black\/\d+)$/.test(token)) continue
          if (/^(?:[^\s:]+:)*(?:bg|text|border)-(?:white|black)(?:\/\d+)?$/.test(token)) {
            offenders.push(`${relative(SRC, file)}: "${token}" in "${text}"`)
          }
        }
      }
    }
    expect(offenders, `Use a semantic token or add a dark: variant:\n${offenders.join('\n')}`).toEqual([])
  })
})
