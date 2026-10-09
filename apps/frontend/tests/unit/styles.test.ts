import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../../src')
// shadcn primitives (components/ui) own their cva inline; everything else must not.
const isShadcn = (file: string) => file.startsWith(join(SRC, 'components/ui'))

function tsx(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? tsx(path) : name.endsWith('.tsx') ? [path] : []
    })
  } catch {
    return [] // layer not created yet
  }
}

// Styling lives in <name>.styles.ts (CVA); TSX only calls it.
describe('styling stays out of TSX', () => {
  it('has no literal className strings, cn() or style props outside components/ui', () => {
    for (const file of tsx(SRC).filter((f) => !isShadcn(f))) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} has an inline class string`).not.toMatch(/className=(["']|\{\s*["'`])/)
      expect(source, `${file} calls cn()`).not.toMatch(/\bcn\(/)
      expect(source, `${file} uses a style prop`).not.toMatch(/style=\{\{/)
    }
  })
})
