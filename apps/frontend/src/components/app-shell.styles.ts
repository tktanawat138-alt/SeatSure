import { cva, type VariantProps } from 'class-variance-authority'

export const root = cva('flex min-h-svh flex-col bg-muted/40')
export const header = cva('sticky top-0 z-40 border-b bg-background/85 backdrop-blur print:hidden')
export const bar = cva('mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:py-0')
export const nav = cva('order-last flex w-full items-center gap-1 sm:order-none sm:w-auto')
export const navLink = cva(
  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:text-foreground',
  {
    variants: {
      active: {
        true: 'bg-muted text-foreground',
        false: 'text-muted-foreground',
      },
    },
    defaultVariants: { active: false },
  },
)
export const navIcon = cva('size-4')
export const user = cva('ml-auto flex items-center gap-1 sm:gap-3')
export const userInfo = cva('flex items-center gap-2')
export const avatarFallback = cva('bg-primary/10 font-medium text-primary')
export const userText = cva('leading-tight')
export const userName = cva('text-sm font-medium')
export const userRole = cva('hidden text-xs text-muted-foreground sm:block')
export const main = cva('mx-auto w-full max-w-6xl flex-1 px-4 py-8')
export type NavLinkProps = VariantProps<typeof navLink>
