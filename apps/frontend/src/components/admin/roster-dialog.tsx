import { CircleAlert, LoaderCircle, Users } from 'lucide-react'
import { paymentProblem, type RosterRow, type RosterView } from '@/components/admin/roster'
import { EmptyState } from '@/components/page-state'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { baht, bookingStatus } from '@/lib/format'
import type { Course } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Below md each booking is restyled into a small block (same table, same DOM): the student
// with the booking status on the first line, then the account and the payments.
const stackedRow = 'max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1 max-md:p-3'
const stackedCell = 'max-md:p-0 max-md:whitespace-normal'

interface Props {
  roster: RosterView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetry: (course: Course) => void
}

export function RosterDialog({ roster, open, onOpenChange, onRetry }: Readonly<Props>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-[min(48rem,calc(100%-2rem))]">
        <DialogHeader className="pr-8">
          <DialogTitle className="leading-snug">รายชื่อและการชำระเงิน</DialogTitle>
          <DialogDescription>{roster?.course.title}</DialogDescription>
        </DialogHeader>
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
          {roster && <RosterBody roster={roster} onRetry={onRetry} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RosterBody({ roster, onRetry }: Readonly<{ roster: RosterView } & Pick<Props, 'onRetry'>>) {
  if (roster.error) {
    return (
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <CircleAlert aria-hidden />
        <AlertDescription>{roster.error}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="xs" onClick={() => onRetry(roster.course)}>
            ลองใหม่
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (!roster.rows) {
    return (
      <output className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        กำลังโหลดรายชื่อ…
      </output>
    )
  }

  if (roster.rows.length === 0) {
    return <EmptyState icon={Users} title="ยังไม่มีผู้จอง" description="เมื่อมีคนจองคอร์สนี้ รายชื่อจะแสดงที่นี่" />
  }

  const now = Date.now()
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className="max-md:block">
        <TableHeader className="bg-muted/50 max-md:sr-only [&_th]:text-muted-foreground">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-3">ผู้เรียน</TableHead>
            <TableHead>บัญชีที่จอง</TableHead>
            <TableHead>สถานะการจอง</TableHead>
            <TableHead className="pr-3">การชำระเงิน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="max-md:block">
          {roster.rows.map((row) => (
            <RosterTableRow key={row.id} row={row} now={now} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RosterTableRow({ row, now }: Readonly<{ row: RosterRow; now: number }>) {
  const status = bookingStatus(row, now)
  const problem = paymentProblem(row)

  return (
    <TableRow className={cn(stackedRow, problem && 'bg-destructive/5 hover:bg-destructive/10')}>
      <TableCell className={cn(stackedCell, 'font-medium whitespace-normal md:pl-3')}>{row.student_name}</TableCell>
      <TableCell
        data-label="บัญชีที่จอง"
        className={cn(
          stackedCell,
          'whitespace-normal max-md:col-span-full max-md:before:mr-1.5 max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]',
        )}
      >
        {row.profiles.full_name}
      </TableCell>
      <TableCell className={cn(stackedCell, 'max-md:col-start-2 max-md:row-start-1')}>
        <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
      </TableCell>
      <TableCell className={cn(stackedCell, 'max-md:col-span-full md:pr-3')}>
        <div className="flex flex-col items-start gap-1">
          {row.payments.length === 0 && <span className="text-muted-foreground">ยังไม่ชำระ</span>}
          {row.payments.map((payment) => {
            const received = payment.status === 'succeeded'
            return (
              <div key={payment.id} className="tabular-nums">
                {payment.receipt_no} · {baht(payment.amount)} ·{' '}
                <span className={cn(!received && 'font-medium text-amber-800')}>
                  {received ? 'รับเงินแล้ว' : 'ต้องคืนเงิน'}
                </span>
              </div>
            )
          })}
          {problem && <StatusBadge tone="bad">{problem}</StatusBadge>}
        </div>
      </TableCell>
    </TableRow>
  )
}
