import { cva, type VariantProps } from 'class-variance-authority'

export const row = cva('flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1')
export const rowLabel = cva('text-muted-foreground')
export const rowValue = cva('ml-auto min-w-0 text-right font-medium break-words')

export const skeletonWrap = cva('mx-auto w-full max-w-lg')
export const skeletonCard = cva('gap-8 py-8')
export const skeletonHead = cva('flex flex-col items-center gap-4 px-6')
export const skeletonTitle = cva('h-7 w-28')
export const skeletonSubtitle = cva('h-6 w-64 max-w-full')
export const skeletonAmount = cva('h-11 w-40')
export const skeletonRows = cva('space-y-4 px-6')
export const skeletonRow = cva('flex justify-between gap-6')
export const skeletonLabel = cva('h-4 w-20')
export const skeletonValue = cva('h-4', {
  variants: {
    width: { w20: 'w-20', w28: 'w-28', w32: 'w-32', w36: 'w-36', w40: 'w-40', w44: 'w-44' },
  },
})
export type SkeletonValueProps = VariantProps<typeof skeletonValue>
export const skeletonWidths = ['w28', 'w36', 'w32', 'w40', 'w20', 'w44'] as const

export const emptyWrap = cva('mx-auto w-full max-w-lg')
export const article = cva('mx-auto w-full max-w-lg space-y-4')
export const card = cva(
  'gap-0 py-0 [print-color-adjust:exact] print:break-inside-avoid print:border print:shadow-none print:ring-0',
)
export const header = cva('flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center')
export const heading = cva('text-lg font-semibold')
export const amountBox = cva('mx-6 rounded-lg bg-muted/60 px-4 py-5 text-center print:bg-transparent print:py-2')
export const amountLabel = cva('text-sm text-muted-foreground')
export const amount = cva('text-4xl leading-normal font-semibold tracking-tight tabular-nums')
export const details = cva('space-y-3.5 px-6 py-6 text-sm')
export const mono = cva('font-mono')
export const numeric = cva('tabular-nums')
export const dashedSeparator = cva('border-t border-dashed bg-transparent')
export const statusBadge = cva('h-auto max-w-full shrink py-0.5 text-left whitespace-normal')
export const note = cva('px-6 py-4 text-center text-xs text-muted-foreground')
export const actions = cva('flex items-center justify-between gap-2 print:hidden')
export const srOnly = cva('sr-only')
