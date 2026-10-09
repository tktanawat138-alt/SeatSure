import { cva } from 'class-variance-authority'

export const list = cva('space-y-3')
export const item = cva('flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3')
export const info = cva('min-w-0 space-y-1')
export const title = cva('font-medium')
export const description = cva('text-sm text-muted-foreground')
export const meta = cva('text-xs text-muted-foreground')
export const actions = cva('flex gap-2')
