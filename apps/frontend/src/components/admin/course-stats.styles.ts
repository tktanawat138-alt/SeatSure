import { cva, type VariantProps } from 'class-variance-authority'

export const root = cva('grid grid-cols-2 gap-4 lg:grid-cols-4')
export const card = cva('', {
  variants: {
    alert: { true: 'bg-destructive/5 ring-destructive/30', false: '' },
  },
  defaultVariants: { alert: false },
})
export const content = cva('space-y-1')
export const top = cva('flex items-center justify-between gap-2')
export const label = cva('text-muted-foreground')
export const icon = cva('size-4 shrink-0', {
  variants: {
    alert: { true: 'text-destructive', false: 'text-muted-foreground' },
  },
  defaultVariants: { alert: false },
})
export const value = cva('text-2xl font-semibold tabular-nums', {
  variants: {
    alert: { true: 'text-destructive', false: '' },
  },
  defaultVariants: { alert: false },
})
export const hint = cva('text-xs text-muted-foreground')
export type StatToneProps = VariantProps<typeof card>
