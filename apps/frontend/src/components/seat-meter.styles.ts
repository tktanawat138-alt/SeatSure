import { cva, type VariantProps } from 'class-variance-authority'

export const root = cva('space-y-1.5')
export const header = cva('flex items-baseline justify-between gap-2 text-sm')
export const status = cva('', {
  variants: { over: { true: 'font-medium text-destructive', false: '' } },
  defaultVariants: { over: false },
})
export const count = cva('text-xs text-muted-foreground tabular-nums')
export const bar = cva('h-1.5', {
  variants: {
    level: {
      normal: '*:data-[slot=progress-indicator]:bg-primary',
      nearFull: '*:data-[slot=progress-indicator]:bg-amber-500',
      full: '*:data-[slot=progress-indicator]:bg-muted-foreground',
      over: '*:data-[slot=progress-indicator]:bg-destructive',
    },
  },
  defaultVariants: { level: 'normal' },
})
export type BarProps = VariantProps<typeof bar>
