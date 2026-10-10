import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../../src')

// Dependencies point inwards: adaptor -> use-cases -> interfaces -> entities.
// Packages are matched as bare specifiers, layers as path segments of relative imports.
const PACKAGES = ['express', 'cors', '@supabase']
const FORBIDDEN: Record<string, { packages: string[]; layers: string[] }> = {
  entities: { packages: PACKAGES, layers: ['interfaces', 'use-cases', 'adaptor'] },
  interfaces: { packages: PACKAGES, layers: ['use-cases', 'adaptor'] },
  'use-cases': { packages: PACKAGES, layers: ['adaptor'] },
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

// from 'x', import 'x', import('x'), require('x')
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g

function importsOf(source: string): string[] {
  return [...source.matchAll(IMPORT)].map((m) => m[1] as string)
}

function breaks(specifier: string, rule: { packages: string[]; layers: string[] }): boolean {
  if (specifier.startsWith('.')) return specifier.split('/').some((part) => rule.layers.includes(part))
  return rule.packages.some((p) => specifier === p || specifier.startsWith(`${p}/`))
}

describe('import scanner', () => {
  const rule = FORBIDDEN['use-cases']!
  it.each([
    ["import express from 'express'", true],
    ["import 'express'", true],
    ["const e = require('express')", true],
    ["const e = await import('@supabase/supabase-js')", true],
    ["import { a } from '../adaptor/x'", true],
    ["import { a } from './express-helper'", false],
    ["import { a } from '../entities/x'", false],
  ])('%s -> banned: %s', (line, banned) => {
    expect(importsOf(line).some((i) => breaks(i, rule))).toBe(banned)
  })
})

describe('layer boundaries', () => {
  for (const [layer, rule] of Object.entries(FORBIDDEN)) {
    it(`${layer} imports nothing from an outer layer or a framework`, () => {
      for (const file of sources(join(SRC, layer))) {
        const bad = importsOf(readFileSync(file, 'utf8')).filter((i) => breaks(i, rule))
        expect(bad, `${file} breaks the ${layer} boundary`).toEqual([])
      }
    })
  }
})
