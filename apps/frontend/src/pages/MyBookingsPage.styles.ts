import { cva } from 'class-variance-authority'

export const refreshError = cva('mb-4')
export const list = cva('space-y-3')
export const footnote = cva('mt-6 text-xs text-muted-foreground')

export const cardContent = cva('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between')
export const info = cva('min-w-0 space-y-1')
export const titleRow = cva('flex flex-wrap items-center gap-x-2.5 gap-y-1')
export const title = cva('text-base font-medium')
export const meta = cva('text-muted-foreground')
export const receiptButton = cva('sm:shrink-0')
export const payBox = cva('flex flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center sm:gap-4')
export const countdown = cva('flex items-center gap-1.5 text-muted-foreground tabular-nums')
export const countdownIcon = cva('size-4 shrink-0')
export const refundAlert = cva('border-destructive/30 bg-destructive/5')
