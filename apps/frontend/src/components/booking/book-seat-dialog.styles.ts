import { cva } from 'class-variance-authority'

export const content = cva('sm:max-w-md')
export const form = cva('grid gap-4')
export const header = cva('pr-8')
export const title = cva('leading-snug')
export const price = cva('font-medium text-foreground tabular-nums')
export const input = cva('h-9')
export const hint = cva('flex items-start gap-2 text-muted-foreground')
export const hintIcon = cva('mt-0.5 size-4 shrink-0')
export const alert = cva('border-destructive/30 bg-destructive/5')
