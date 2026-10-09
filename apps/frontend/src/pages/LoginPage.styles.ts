import { cva, type VariantProps } from 'class-variance-authority'

export const brandPanel = cva(
  'relative hidden flex-col justify-between gap-12 overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-14',
)
export const brandDots = cva(
  'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.16)_1px,transparent_0)] bg-size-[24px_24px] [mask-image:linear-gradient(to_bottom_right,black,transparent_70%)]',
)
export const brandLogo = cva('relative text-lg')
export const brandBody = cva('relative max-w-md space-y-10')
export const headline = cva('text-3xl leading-normal font-semibold xl:text-4xl xl:leading-normal')
export const headlineLine = cva('block', {
  variants: { muted: { true: 'text-primary-foreground/70' } },
})
export const promiseList = cva('space-y-5')
export const promiseItem = cva('flex items-start gap-3.5')
export const promiseIcon = cva(
  'flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/15',
)
export const promiseIconSvg = cva('size-5')
export const promiseTitle = cva('font-medium')
export const promiseText = cva('text-sm text-primary-foreground/75')
export const brandFooter = cva('relative text-sm text-primary-foreground/70')

export const demoSection = cva('space-y-3 rounded-xl border border-dashed bg-background px-6 py-5')
export const demoHeader = cva('space-y-0.5')
export const demoTitle = cva('flex items-center gap-1.5 text-sm font-medium')
export const demoTitleIcon = cva('size-4 text-muted-foreground')
export const demoHint = cva('text-xs text-muted-foreground')
export const demoGroup = cva('space-y-1.5')
export const demoGroupLabel = cva('text-xs font-medium text-muted-foreground')
export const demoGrid = cva('grid grid-cols-2 gap-1.5', {
  variants: { flow: { columns: 'grid-flow-col grid-rows-5', rows: '' } },
  defaultVariants: { flow: 'rows' },
})
export type DemoGridProps = VariantProps<typeof demoGrid>

export const page = cva('grid min-h-svh lg:grid-cols-2')
export const main = cva('flex flex-col items-center justify-center bg-muted/40 px-4 py-10 sm:px-6')
export const column = cva('flex w-full max-w-sm flex-col gap-6')
export const mobileLogo = cva('justify-center text-lg lg:hidden')
export const card = cva('gap-6 py-6')
export const cardHeader = cva('px-6')
export const cardTitle = cva('text-xl')
export const cardContent = cva('px-6')
export const input = cva('h-9')
export const errorAlert = cva('border-destructive/30 bg-destructive/5')
export const submitButton = cva('w-full')
