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
import { cn } from '@/lib/utils'

// Below lg the same table is restyled into one stacked block per course, so every control
// exists once in the page. A stacked cell shows its column name from data-label.
const stackedRow =
  'max-lg:grid max-lg:gap-x-10 max-lg:gap-y-1.5 max-lg:px-4 max-lg:py-4 max-lg:first:pt-1 max-lg:hover:bg-transparent sm:max-lg:grid-cols-2'
const stackedCell =
  'max-lg:flex max-lg:min-h-8 max-lg:items-center max-lg:justify-between max-lg:gap-3 max-lg:p-0 max-lg:before:text-muted-foreground max-lg:before:content-[attr(data-label)]'

interface Actions {
  busy: boolean
  onSaveCapacity: (event: SubmitEvent<HTMLFormElement>, course: Course) => void
  onToggleRegistration: (course: Course) => void
  onOpenRoster: (course: Course) => void
}

export function CourseTable({ courses, ...actions }: Readonly<{ courses: Course[] } & Actions>) {
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>
          <h2>คอร์สทั้งหมด</h2>
        </CardTitle>
        <CardDescription>แก้จำนวนรับแล้วกดบันทึก ส่วนสวิตช์รับสมัครมีผลทันที</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="max-lg:block">
          <TableHeader className="bg-muted/50 max-lg:sr-only [&_th]:text-muted-foreground [&_tr]:border-t">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">คอร์ส</TableHead>
              <TableHead>ที่นั่งที่จองแล้ว</TableHead>
              <TableHead>ราคา</TableHead>
              <TableHead>จำนวนรับ</TableHead>
              <TableHead>รับสมัคร</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">รายชื่อ</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="max-lg:block">
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
    <TableRow className={stackedRow}>
      <TableCell className="whitespace-normal max-lg:col-span-full max-lg:p-0 lg:pl-4">
        <p id={titleId} className="font-medium">
          {course.title}
        </p>
        <p className="text-muted-foreground">{course.teacher_name ?? 'ยังไม่ระบุผู้สอน'}</p>
      </TableCell>

      <TableCell data-label="ที่นั่งที่จองแล้ว" className={stackedCell}>
        <div className="flex flex-wrap items-center gap-2 max-lg:justify-end">
          <span className="tabular-nums">
            {course.seats_taken} / {course.capacity}
          </span>
          <SeatNote over={course.seats_taken - course.capacity} />
        </div>
      </TableCell>

      <TableCell data-label="ราคา" className={cn(stackedCell, 'tabular-nums')}>
        {baht(course.price)}
      </TableCell>

      <TableCell data-label="จำนวนรับ" className={stackedCell}>
        <form className="flex items-center gap-2" onSubmit={(event) => onSaveCapacity(event, course)}>
          <Input
            key={course.capacity}
            className="h-7 w-20 tabular-nums"
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

      <TableCell data-label="รับสมัคร" className={stackedCell}>
        <div className="flex items-center gap-2">
          <Switch
            checked={open}
            disabled={busy}
            onCheckedChange={() => onToggleRegistration(course)}
            aria-label={`เปิดรับสมัคร ${course.title}`}
          />
          <span className={cn('min-w-11', !open && 'text-muted-foreground')}>{open ? 'เปิดรับ' : 'ปิดรับ'}</span>
        </div>
      </TableCell>

      <TableCell className="max-lg:col-span-full max-lg:p-0 max-lg:pt-1 lg:pr-4 lg:text-right">
        <Button
          variant="outline"
          size="sm"
          className="max-lg:h-8 max-lg:w-full"
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
