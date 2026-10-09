import { cva } from 'class-variance-authority'

export const card = cva('w-full')
export const header = cva('gap-x-3')
export const teacher = cva('flex items-center gap-1.5')
export const teacherIcon = cva('size-3.5 shrink-0')
export const schedule = cva('text-sm text-muted-foreground')
export const price = cva('text-lg leading-5.5 font-semibold tabular-nums')
export const content = cva('flex flex-1 flex-col gap-4')
export const meter = cva('mt-auto')
export const actions = cva('flex min-h-9 w-full flex-wrap items-center justify-between gap-2')
export const bookButton = cva('w-full')
export const unavailable = cva('flex h-9 w-full items-center justify-center rounded-lg border border-dashed font-medium text-muted-foreground')
