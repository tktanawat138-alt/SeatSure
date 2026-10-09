import { cva, type VariantProps } from 'class-variance-authority'

export const nowrap = cva('whitespace-nowrap')

export const rosterWrap = cva('border-t')
export const tableHeader = cva('bg-muted/50')
export const headRow = cva('hover:bg-transparent')
export const headCell = cva('text-muted-foreground', {
  variants: {
    column: {
      rank: 'w-14 pl-4',
      name: '',
      status: '',
      time: 'pr-4 text-right',
    },
  },
  defaultVariants: { column: 'name' },
})
export const cell = cva('', {
  variants: {
    column: {
      rank: 'pl-4 text-muted-foreground tabular-nums',
      name: 'font-medium whitespace-normal',
      status: '',
      time: 'w-px pr-4 text-right whitespace-normal text-muted-foreground tabular-nums sm:w-auto sm:whitespace-nowrap',
    },
  },
  defaultVariants: { column: 'status' },
})

export const courseCard = cva('', {
  variants: { hasStudents: { true: 'pb-0' } },
})
export type CourseCardProps = VariantProps<typeof courseCard>
export const countBadge = cva('tabular-nums')
export const courseActions = cva('flex flex-col items-end gap-2')
export const courseSchedule = cva('text-sm text-muted-foreground')
export const approvalSummary = cva('mb-4 rounded-lg border p-3 text-sm text-muted-foreground')
export const emptyNote = cva(
  'flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground',
)
export const emptyIcon = cva('size-4')
export const grid = cva('grid items-start gap-4 lg:grid-cols-2')
