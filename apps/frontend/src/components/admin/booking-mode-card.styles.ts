import { cva } from 'class-variance-authority'

export const body = cva('text-muted-foreground')
export const footer = cva('flex-wrap justify-between gap-3')
export const current = cva('flex flex-wrap items-center gap-2')
export const code = cva('rounded bg-muted px-1 py-0.5 font-mono text-xs whitespace-nowrap text-foreground')
export const media = cva('bg-destructive/10 text-destructive')
