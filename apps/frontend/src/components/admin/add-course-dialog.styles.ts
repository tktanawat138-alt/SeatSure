import { cva } from 'class-variance-authority'

export const dialog = cva('max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md')
export const header = cva('pr-8')
export const title = cva('leading-snug')
export const form = cva('grid gap-4')
export const fields = cva('gap-4')
export const input = cva('h-9', {
  variants: {
    numeric: { true: 'tabular-nums', false: '' },
  },
  defaultVariants: { numeric: false },
})
export const selectTrigger = cva('w-full data-[size=default]:h-9')
export const pair = cva('grid grid-cols-2 gap-4')
export const errorAlert = cva('border-destructive/30 bg-destructive/5')
