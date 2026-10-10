import { cva } from 'class-variance-authority'

export const grid = cva('grid gap-4 md:grid-cols-2')
export const card = cva('min-w-0')
// The fixed height includes the x-axis band, so the plot never needs its own scrollbar.
export const chart = cva('aspect-auto h-48 w-full')
export const empty = cva('flex h-48 items-center justify-center text-sm text-muted-foreground')
export const axisTick = cva('tabular-nums')
export const tooltipKey = cva('h-0.5 w-3 shrink-0 self-center rounded-full bg-(--color-value)')
export const tooltipValue = cva('font-medium text-foreground tabular-nums')
export const tooltipUnit = cva('text-muted-foreground')
export const srOnly = cva('sr-only')
