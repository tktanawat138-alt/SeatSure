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
import * as s from './roster-dialog.styles'

interface Props {
  roster: RosterView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetry: (course: Course) => void
}

export function RosterDialog({ roster, open, onOpenChange, onRetry }: Readonly<Props>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={s.dialog()}>
        <DialogHeader className={s.header()}>
          <DialogTitle className={s.title()}>รายชื่อและการชำระเงิน</DialogTitle>
          <DialogDescription>{roster?.course.title}</DialogDescription>
        </DialogHeader>
        <div className={s.scroller()}>{roster && <RosterBody roster={roster} onRetry={onRetry} />}</div>
      </DialogContent>
    </Dialog>
  )
}

function RosterBody({ roster, onRetry }: Readonly<{ roster: RosterView } & Pick<Props, 'onRetry'>>) {
  if (roster.error) {
    return (
      <Alert variant="destructive" className={s.errorAlert()}>
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
      <output className={s.loading()}>
        <LoaderCircle className={s.spinner()} aria-hidden />
        กำลังโหลดรายชื่อ…
      </output>
    )
  }

  if (roster.rows.length === 0) {
    return <EmptyState icon={Users} title="ยังไม่มีผู้จอง" description="เมื่อมีคนจองคอร์สนี้ รายชื่อจะแสดงที่นี่" />
  }

  const now = Date.now()
  return (
    <div className={s.frame()}>
      <Table className={s.table()}>
        <TableHeader className={s.head()}>
          <TableRow className={s.headRow()}>
            <TableHead className={s.headCell({ edge: 'start' })}>ผู้เรียน</TableHead>
            <TableHead>บัญชีที่จอง</TableHead>
            <TableHead>สถานะการจอง</TableHead>
            <TableHead className={s.headCell({ edge: 'end' })}>การชำระเงิน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className={s.body()}>
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
    <TableRow className={s.row({ problem: !!problem })}>
      <TableCell className={s.cell({ kind: 'student' })}>{row.student_name}</TableCell>
      <TableCell data-label="บัญชีที่จอง" className={s.cell({ kind: 'account' })}>
        {row.profiles.full_name}
      </TableCell>
      <TableCell className={s.cell({ kind: 'status' })}>
        <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
      </TableCell>
      <TableCell className={s.cell({ kind: 'payments' })}>
        <div className={s.payments()}>
          {row.payments.length === 0 && <span className={s.unpaid()}>ยังไม่ชำระ</span>}
          {row.payments.map((payment) => {
            const received = payment.status === 'succeeded'
            return (
              <div key={payment.id} className={s.payment()}>
                {payment.receipt_no} · {baht(payment.amount)} ·{' '}
                <span className={s.paymentState({ received })}>{received ? 'รับเงินแล้ว' : 'ต้องคืนเงิน'}</span>
              </div>
            )
          })}
          {row.payment_proofs.length > 0 && (
            <div className={s.proofList()}>
              {row.payment_proofs.map((proof, index) => proof.signed_url ? (
                <a key={proof.id} className={s.proofLink()} href={proof.signed_url} target="_blank" rel="noreferrer">
                  ดูหลักฐานการโอน {index + 1}
                </a>
              ) : <span key={proof.id} className={s.unpaid()}>เปิดหลักฐานไม่ได้</span>)}
            </div>
          )}
          {problem && <StatusBadge tone="bad">{problem}</StatusBadge>}
        </div>
      </TableCell>
    </TableRow>
  )
}
