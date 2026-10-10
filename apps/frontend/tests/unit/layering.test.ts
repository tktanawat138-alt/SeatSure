import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../../src')

// Layer -> import prefixes it must never use. Dependencies point inwards:
// ui -> use-cases -> entities, adaptor -> interfaces/entities.
const FORBIDDEN: Record<string, string[]> = {
  entities: ['react', '@supabase', '@/interfaces', '@/use-cases', '@/adaptor', '@/ui'],
  interfaces: ['react', '@supabase', '@/use-cases', '@/adaptor', '@/ui'],
  'use-cases': ['react', '@supabase', '@/adaptor', '@/ui'],
  adaptor: ['react', '@/use-cases', '@/ui'],
}

function sources(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : []
    })
  } catch {
    return [] // layer not created yet
  }
}

describe('layer boundaries', () => {
  for (const [layer, banned] of Object.entries(FORBIDDEN)) {
    it(`${layer} imports nothing from an outer layer`, () => {
      for (const file of sources(join(SRC, layer))) {
        const imports = [...readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
        const bad = imports.filter((i) => banned.some((b) => i === b || i.startsWith(`${b}/`)))
        expect(bad, `${file} breaks the ${layer} boundary`).toEqual([])
      }
    })
  }
})

describe('no Supabase client in the frontend', () => {
  it('nothing under src imports @supabase or @/lib/supabase', () => {
    for (const file of sources(SRC)) {
      const imports = [...readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
      const bad = imports.filter((i) => i.startsWith('@supabase') || i === '@/lib/supabase')
      expect(bad, `${file} must not use the Supabase client; talk to the API`).toEqual([])
    }
  })
})
