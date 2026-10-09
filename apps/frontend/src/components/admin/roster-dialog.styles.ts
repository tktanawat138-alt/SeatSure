import { cva } from 'class-variance-authority'

export const dialog = cva('flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-[min(48rem,calc(100%-2rem))]')
export const header = cva('pr-8')
export const title = cva('leading-snug')
export const scroller = cva('-mx-4 min-h-0 flex-1 overflow-y-auto px-4')
export const errorAlert = cva('border-destructive/30 bg-destructive/5')
export const loading = cva('flex items-center justify-center gap-2 py-12 text-muted-foreground')
export const spinner = cva('size-4 animate-spin')
export const frame = cva('overflow-hidden rounded-lg border')

// Below md each booking is restyled into a small block (same table, same DOM): the student
// with the booking status on the first line, then the account and the payments.
export const table = cva('max-md:block')
export const head = cva('bg-muted/50 max-md:sr-only [&_th]:text-muted-foreground')
export const headRow = cva('hover:bg-transparent')
export const headCell = cva('', {
  variants: {
    edge: { start: 'pl-3', end: 'pr-3' },
  },
})
export const body = cva('max-md:block')
export const row = cva('max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1 max-md:p-3', {
  variants: {
    problem: { true: 'bg-destructive/5 hover:bg-destructive/10', false: '' },
  },
  defaultVariants: { problem: false },
})
export const cell = cva('max-md:p-0 max-md:whitespace-normal', {
  variants: {
    kind: {
      student: 'font-medium whitespace-normal md:pl-3',
      account:
        'whitespace-normal max-md:col-span-full max-md:before:mr-1.5 max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]',
      status: 'max-md:col-start-2 max-md:row-start-1',
      payments: 'max-md:col-span-full md:pr-3',
    },
  },
})
export const payments = cva('flex flex-col items-start gap-1')
export const unpaid = cva('text-muted-foreground')
export const payment = cva('tabular-nums')
export const paymentState = cva('', {
  variants: {
    received: { true: '', false: 'font-medium text-amber-800' },
  },
})
