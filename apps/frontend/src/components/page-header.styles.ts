import { cva } from 'class-variance-authority'

export const root = cva('mb-6 flex flex-wrap items-end justify-between gap-3')
export const titleGroup = cva('space-y-1')
export const heading = cva('text-2xl font-semibold tracking-tight')
export const subtitle = cva('text-sm text-muted-foreground')
export const actions = cva('flex items-center gap-2')
