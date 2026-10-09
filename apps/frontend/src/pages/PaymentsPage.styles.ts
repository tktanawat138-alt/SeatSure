import { cva } from 'class-variance-authority'

export const stack = cva('space-y-6')
export const courseList = cva('grid gap-3')
export const courseRow = cva('flex flex-wrap items-center justify-between gap-3')
export const courseInfo = cva('min-w-0 space-y-1')
export const courseTitle = cva('font-medium')
export const courseMeta = cva('text-sm text-muted-foreground')
export const courseCount = cva('tabular-nums text-sm text-muted-foreground')
export const error = cva('mb-4')
