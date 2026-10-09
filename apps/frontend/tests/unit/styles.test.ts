import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const UI = join(import.meta.dirname, '../../src/ui')

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
  it('src/ui has no literal className strings or style props', () => {
    for (const file of tsx(UI)) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} has an inline class string`).not.toMatch(/className=(["']|\{\s*["'`])/)
      expect(source, `${file} uses a style prop`).not.toMatch(/style=\{\{/)
    }
  })
})
