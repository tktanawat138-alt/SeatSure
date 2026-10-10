import { cva } from 'class-variance-authority'

// Long Thai sentences wrap inside their cell; below the minimum width the table scrolls inside the card.
export const table = cva('min-w-[640px]')
export const metric = cva('align-top font-medium')
export const text = cva('align-top whitespace-normal')
export const code = cva('rounded bg-muted px-1 py-0.5 font-mono text-xs')
