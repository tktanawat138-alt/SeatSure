import { useId, type SubmitEvent } from 'react'
import { Users } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { baht } from '@/lib/format'
import type { Course } from '@/lib/supabase'
import * as s from './course-table.styles'

interface Actions {
  busy: boolean
  onSaveCapacity: (event: SubmitEvent<HTMLFormElement>, course: Course) => void
  onToggleRegistration: (course: Course) => void
  onOpenRoster: (course: Course) => void
}

export function CourseTable({ courses, ...actions }: Readonly<{ courses: Course[] } & Actions>) {
  return (
    <Card className={s.card()}>
      <CardHeader>
        <CardTitle>
          <h2>คอร์สทั้งหมด</h2>
        </CardTitle>
        <CardDescription>แก้จำนวนรับแล้วกดบันทึก ส่วนสวิตช์รับสมัครมีผลทันที</CardDescription>
      </CardHeader>
      <CardContent className={s.content()}>
        <Table className={s.table()}>
          <TableHeader className={s.head()}>
            <TableRow className={s.headRow()}>
              <TableHead className={s.headCell({ edge: 'start' })}>คอร์ส</TableHead>
              <TableHead>ที่นั่งที่จองแล้ว</TableHead>
              <TableHead>ราคา</TableHead>
              <TableHead>จำนวนรับ</TableHead>
              <TableHead>รับสมัคร</TableHead>
              <TableHead className={s.headCell({ edge: 'end' })}>
                <span className={s.srOnly()}>รายชื่อ</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={s.body()}>
            {courses.map((course) => (
              <CourseRow key={course.id} course={course} {...actions} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CourseRow({
  course,
  busy,
  onSaveCapacity,
  onToggleRegistration,
  onOpenRoster,
}: Readonly<{ course: Course } & Actions>) {
  const titleId = useId()
  const open = course.registration_open

  return (
    <TableRow className={s.row()}>
      <TableCell className={s.cell({ kind: 'title' })}>
        <p id={titleId} className={s.name()}>
          {course.title}
        </p>
        <p className={s.muted()}>{course.teacher_name ?? 'ยังไม่ระบุผู้สอน'}</p>
      </TableCell>

      <TableCell data-label="ที่นั่งที่จองแล้ว" className={s.cell({ kind: 'field' })}>
        <div className={s.seats()}>
          <span className={s.seatCount()}>
            {course.seats_taken} / {course.capacity}
          </span>
          <SeatNote over={course.seats_taken - course.capacity} />
        </div>
      </TableCell>

      <TableCell data-label="ราคา" className={s.cell({ kind: 'number' })}>
        {baht(course.price)}
      </TableCell>

      <TableCell data-label="จำนวนรับ" className={s.cell({ kind: 'field' })}>
        <form className={s.capacityForm()} onSubmit={(event) => onSaveCapacity(event, course)}>
          <Input
            key={course.capacity}
            className={s.capacityInput()}
            name="capacity"
            type="number"
            min={1}
            defaultValue={course.capacity}
            aria-label={`จำนวนรับของ ${course.title}`}
            required
          />
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            บันทึก
          </Button>
        </form>
      </TableCell>

      <TableCell data-label="รับสมัคร" className={s.cell({ kind: 'field' })}>
        <div className={s.toggle()}>
          <Switch
            checked={open}
            disabled={busy}
            onCheckedChange={() => onToggleRegistration(course)}
            aria-label={`เปิดรับสมัคร ${course.title}`}
          />
          <span className={s.toggleText({ open })}>{open ? 'เปิดรับ' : 'ปิดรับ'}</span>
        </div>
      </TableCell>

      <TableCell className={s.cell({ kind: 'action' })}>
        <Button
          variant="outline"
          size="sm"
          className={s.rosterButton()}
          aria-haspopup="dialog"
          aria-describedby={titleId}
          onClick={() => onOpenRoster(course)}
        >
          <Users data-icon="inline-start" aria-hidden />
          รายชื่อและการชำระเงิน
        </Button>
      </TableCell>
    </TableRow>
  )
}

function SeatNote({ over }: Readonly<{ over: number }>) {
  if (over > 0) return <StatusBadge tone="bad">จองเกิน {over} ที่นั่ง</StatusBadge>
  if (over === 0) return <StatusBadge tone="muted">เต็มแล้ว</StatusBadge>
  return null
}
