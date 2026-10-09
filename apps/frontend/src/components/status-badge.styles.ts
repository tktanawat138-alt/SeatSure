import { cva, type VariantProps } from 'class-variance-authority'

export const dot = cva('size-1.5 rounded-full bg-current')
export const badge = cva('', {
  variants: {
    tone: {
      ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      warn: 'border-amber-200 bg-amber-50 text-amber-800',
      bad: 'border-red-200 bg-red-50 text-red-700',
      muted: 'border-transparent bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'muted' },
})
export type BadgeProps = VariantProps<typeof badge>
