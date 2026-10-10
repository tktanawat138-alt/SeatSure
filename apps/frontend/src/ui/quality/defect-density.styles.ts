import { cva } from 'class-variance-authority'

// Chart beside the table from lg up, stacked below it. min-w-0 lets the table scroll inside the card.
export const layout = cva('grid gap-6 lg:grid-cols-5')
export const chartPane = cva('min-w-0 lg:col-span-2')
export const tablePane = cva('min-w-0 lg:col-span-3')
export const chart = cva('aspect-auto h-56 w-full')
export const barLabel = cva('fill-foreground tabular-nums')
export const tooltipKey = cva('size-2.5 shrink-0 self-center rounded-[2px] bg-(--color-density)')
export const tooltipValue = cva('font-medium text-foreground tabular-nums')
export const tooltipUnit = cva('text-muted-foreground')
export const number = cva('text-right tabular-nums')
export const name = cva('font-medium')
export const muted = cva('text-muted-foreground')
