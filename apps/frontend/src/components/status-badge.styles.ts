import { cva, type VariantProps } from 'class-variance-authority'

export const dot = cva('size-1.5 rounded-full bg-current')
export const badge = cva('', {
  variants: {
    tone: {
      ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
      bad: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
      muted: 'border-transparent bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'muted' },
})
export type BadgeProps = VariantProps<typeof badge>
