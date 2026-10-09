import { cva } from 'class-variance-authority'

// Below lg the same table is restyled into one stacked block per course, so every control
// exists once in the page. A stacked cell shows its column name from data-label.
export const card = cva('pb-0')
export const content = cva('px-0')
export const table = cva('max-lg:block')
export const head = cva('bg-muted/50 max-lg:sr-only [&_th]:text-muted-foreground [&_tr]:border-t')
export const headRow = cva('hover:bg-transparent')
export const headCell = cva('', {
  variants: {
    edge: { start: 'pl-4', end: 'pr-4' },
  },
})
export const body = cva('max-lg:block')
export const row = cva(
  'max-lg:grid max-lg:gap-x-10 max-lg:gap-y-1.5 max-lg:px-4 max-lg:py-4 max-lg:first:pt-1 max-lg:hover:bg-transparent sm:max-lg:grid-cols-2',
)
export const cell = cva('', {
  variants: {
    kind: {
      title: 'whitespace-normal max-lg:col-span-full max-lg:p-0 lg:pl-4',
      field:
        'max-lg:flex max-lg:min-h-8 max-lg:items-center max-lg:justify-between max-lg:gap-3 max-lg:p-0 max-lg:before:text-muted-foreground max-lg:before:content-[attr(data-label)]',
      number:
        'max-lg:flex max-lg:min-h-8 max-lg:items-center max-lg:justify-between max-lg:gap-3 max-lg:p-0 max-lg:before:text-muted-foreground max-lg:before:content-[attr(data-label)] tabular-nums',
      action: 'max-lg:col-span-full max-lg:p-0 max-lg:pt-1 lg:pr-4 lg:text-right',
    },
  },
})
export const name = cva('font-medium')
export const muted = cva('text-muted-foreground')
export const seats = cva('flex flex-wrap items-center gap-2 max-lg:justify-end')
export const seatCount = cva('tabular-nums')
export const capacityForm = cva('flex items-center gap-2')
export const capacityInput = cva('h-7 w-20 tabular-nums')
export const toggle = cva('flex items-center gap-2')
export const toggleText = cva('min-w-11', {
  variants: {
    open: { true: '', false: 'text-muted-foreground' },
  },
})
export const rosterButton = cva('max-lg:h-8 max-lg:w-full')
export const srOnly = cva('sr-only')
