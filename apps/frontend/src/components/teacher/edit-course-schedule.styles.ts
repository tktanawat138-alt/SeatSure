import { cva } from 'class-variance-authority'

export const dialog = cva('sm:max-w-lg')
export const header = cva('pr-8')
export const form = cva('grid gap-4')
export const fields = cva('gap-4')
export const pair = cva('grid gap-4 sm:grid-cols-2')
export const error = cva('border-destructive/30 bg-destructive/5')
