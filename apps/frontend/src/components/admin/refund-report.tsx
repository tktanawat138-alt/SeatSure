import { ReceiptText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/page-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { baht, dateTime } from '@/lib/format'
import type { RefundReport } from '@/entities/payment-system'
import * as s from './refund-report.styles'

export function RefundReport({ rows }: Readonly<{ rows: RefundReport[] }>) {
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>รายงานคืนเงิน</h2>
        </CardTitle>
        <CardDescription>
          รายชื่อผู้เรียนที่ชำระแล้วในคอร์สที่ยกเลิก รายงานนี้ใช้ติดตามงานและไม่ได้โอนเงินคืนให้อัตโนมัติ
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{rows.length} รายการ · {baht(total)}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={ReceiptText} title="ยังไม่มีรายการคืนเงิน" description="เมื่อยกเลิกคอร์สที่มีผู้ชำระแล้ว รายการจะปรากฏที่นี่" />
        ) : (
          <div className={s.frame()}>
            <Table className={s.table()}>
              <TableHeader>
                <TableRow>
                  <TableHead>คอร์ส / เหตุผล</TableHead>
                  <TableHead>นักเรียน / ผู้จอง</TableHead>
                  <TableHead>ใบเสร็จ / วันที่</TableHead>
                  <TableHead className={s.amountHead()}>ยอดคืน</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className={s.primary()}>{row.course_title}</p>
                      <p className={s.muted()}>{row.cancellation_reason}</p>
                    </TableCell>
                    <TableCell>
                      <p className={s.primary()}>{row.student_name}</p>
                      <p className={s.muted()}>{row.account_name} · {row.account_email || 'ไม่มีอีเมล'}</p>
                    </TableCell>
                    <TableCell>
                      <p className={s.primary()}>{row.receipt_no}</p>
                      <p className={s.muted()}>{dateTime(row.created_at)}</p>
                    </TableCell>
                    <TableCell className={s.amount()}>{baht(Number(row.amount))}</TableCell>
                    <TableCell><Badge variant="outline">รอดำเนินการ</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
