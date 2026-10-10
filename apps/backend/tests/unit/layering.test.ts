import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../../src')

// Layer -> modules it must never import. Dependencies point inwards:
// adaptor -> use-cases -> interfaces -> entities.
const FRAMEWORKS = ['express', 'cors', '@supabase']
const FORBIDDEN: Record<string, string[]> = {
  entities: [...FRAMEWORKS, 'interfaces', 'use-cases', 'adaptor'],
  interfaces: [...FRAMEWORKS, 'use-cases', 'adaptor'],
  'use-cases': [...FRAMEWORKS, 'adaptor'],
}

function sources(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? sources(path) : /\.ts$/.test(name) ? [path] : []
    })
  } catch {
    return [] // layer not created yet
  }
}

function breaks(specifier: string, banned: string[]): boolean {
  return banned.some((b) =>
    b.startsWith('@') || !specifier.startsWith('.')
      ? specifier === b || specifier.startsWith(`${b}/`)
      : specifier.split('/').includes(b),
  )
}

describe('layer boundaries', () => {
  for (const [layer, banned] of Object.entries(FORBIDDEN)) {
    it(`${layer} imports nothing from an outer layer or a framework`, () => {
      for (const file of sources(join(SRC, layer))) {
        const imports = [...readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
        const bad = imports.filter((i) => breaks(i, banned))
        expect(bad, `${file} breaks the ${layer} boundary`).toEqual([])
      }
    })
  }
})
