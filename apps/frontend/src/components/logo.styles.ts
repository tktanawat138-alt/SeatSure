import { cva, type VariantProps } from 'class-variance-authority'

export const root = cva('flex items-center gap-2 text-base font-semibold tracking-tight')
export const mark = cva('flex size-7 items-center justify-center rounded-lg', {
  variants: {
    inverted: {
      true: 'bg-primary-foreground text-primary',
      false: 'bg-primary text-primary-foreground',
    },
  },
  defaultVariants: { inverted: false },
})
export const icon = cva('size-4')
export type MarkProps = VariantProps<typeof mark>
