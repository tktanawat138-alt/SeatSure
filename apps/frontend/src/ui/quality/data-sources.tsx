import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import * as s from './data-sources.styles'

const Label = ({ children }: Readonly<{ children: string }>) => <code className={s.code()}>{children}</code>

const rows: { metric: string; source: ReactNode; method: string }[] = [
  {
    metric: 'Deployment Frequency',
    source: 'GitHub Actions, run ที่ deploy ขึ้น production สำเร็จ',
    method: 'นับจำนวนครั้งต่อสัปดาห์',
  },
  {
    metric: 'Lead Time for Changes',
    source: 'GitHub, เวลา commit แรกของ pull request ถึงเวลา deploy สำเร็จ',
    method: 'ค่ามัธยฐาน',
  },
  {
    metric: 'Change Failure Rate',
    source: <>GitHub Issues ที่ติด label <Label>incident</Label> ผูกกับการ deploy</>,
    method: 'จำนวน deploy ที่เกิดปัญหา ÷ deploy ทั้งหมด',
  },
  {
    metric: 'Time to Restore',
    source: <>GitHub Issues ที่ติด label <Label>incident</Label>, เวลาเปิดถึงเวลาปิด</>,
    method: 'ค่ามัธยฐาน',
  },
  {
    metric: 'Defect Density',
    source: <>GitHub Issues ที่ติด label <Label>bug</Label> แยกตาม label โมดูล และขนาดโค้ด (ncloc) จาก SonarQube</>,
    method: 'จำนวน defect ÷ KLOC',
  },
]

/** Where each figure will come from once the page reads real data instead of the sample. */
export function DataSources() {
  return (
    <Card>
      <CardContent>
        <Table className={s.table()}>
          <TableHeader>
            <TableRow>
              <TableHead>ตัวชี้วัด</TableHead>
              <TableHead>แหล่งข้อมูลจริง</TableHead>
              <TableHead>วิธีคำนวณ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.metric}>
                <TableCell className={s.metric()}>{row.metric}</TableCell>
                <TableCell className={s.text()}>{row.source}</TableCell>
                <TableCell className={s.text()}>{row.method}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
