import { cva, type VariantProps } from 'class-variance-authority'

export const grid = cva('grid gap-4 sm:grid-cols-2 lg:grid-cols-4')
export const content = cva('mt-auto space-y-3')
export const figure = cva('flex flex-wrap items-baseline gap-x-1.5')
// A headline figure keeps proportional digits; tabular digits look loose at this size.
export const value = cva('text-3xl font-semibold tracking-tight', {
  variants: {
    empty: { true: 'text-muted-foreground', false: '' },
  },
  defaultVariants: { empty: false },
})
export const unit = cva('text-sm text-muted-foreground')
export const status = cva('flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1')
export const trend = cva('inline-flex items-center gap-1 text-xs font-medium', {
  variants: {
    trend: {
      better: 'text-emerald-700 dark:text-emerald-300',
      worse: 'text-red-700 dark:text-red-300',
      flat: 'text-muted-foreground',
    },
  },
  defaultVariants: { trend: 'flat' },
})
export const trendIcon = cva('size-3.5')
export const comparison = cva('text-xs text-muted-foreground')
export type TrendProps = VariantProps<typeof trend>
