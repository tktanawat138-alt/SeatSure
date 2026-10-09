import { useId, type ReactNode } from 'react'
import { ArrowRight, ReceiptText, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { SeatMeter } from '@/components/seat-meter'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { baht, parentCourseSchedule } from '@/lib/format'
import type { Booking, Course } from '@/lib/supabase'
import {
  actions,
  bookButton,
  card,
  content,
  header,
  meter,
  price,
  schedule,
  teacher,
  teacherIcon,
  unavailable,
} from './course-card.styles'

interface CourseCardProps {
  course: Course
  /** The parent's own booking that holds a seat in this course (paid, or a hold still running). */
  mine: Booking | undefined
  onBook: () => void
}

/** One course in the parent's list. It fills its grid cell so every card in a row is the same height. */
export function CourseCard({ course, mine, onBook }: Readonly<CourseCardProps>) {
  const titleId = useId()

  return (
    <Card className={card()}>
      <CardHeader className={header()}>
        <CardTitle>
          <h2 id={titleId}>{course.title}</h2>
        </CardTitle>
        <CardDescription className={teacher()}>
          <UserRound className={teacherIcon()} aria-hidden />
          {course.teacher_name ? `สอนโดย ${course.teacher_name}` : 'ยังไม่ระบุผู้สอน'}
        </CardDescription>
        {/* Same line height as the title, so the price sits on the title's baseline. */}
        <CardAction className={price()}>{baht(course.price)}</CardAction>
      </CardHeader>

      <CardContent className={content()}>
        {course.description && <p>{course.description}</p>}
        {course.starts_at && course.ends_at && <p className={schedule()}>{parentCourseSchedule(course.starts_at, course.ends_at)}</p>}
        <SeatMeter taken={course.seats_taken} capacity={course.capacity} className={meter()} />
      </CardContent>

      {/* min-h-9 is the height of the booking button, so the footers line up across a row. */}
      <CardFooter>
        <div className={actions()}>
          <CourseAction course={course} mine={mine} onBook={onBook} titleId={titleId} />
        </div>
      </CardFooter>
    </Card>
  )
}

/** What the parent can do with one course: open their booking, see why it is unavailable, or book it. */
function CourseAction({ course, mine, onBook, titleId }: Readonly<CourseCardProps & { titleId: string }>) {
  if (mine?.status === 'paid') {
    return (
      <>
        <StatusBadge tone="ok">ชำระแล้ว</StatusBadge>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/receipt/${mine.id}`} aria-describedby={titleId}>
            <ReceiptText data-icon="inline-start" aria-hidden />
            ดูใบเสร็จ
          </Link>
        </Button>
      </>
    )
  }
  if (mine) {
    return (
      <>
        <StatusBadge tone="warn">จองไว้แล้ว รอชำระเงิน</StatusBadge>
        <Button size="sm" asChild>
          <Link to="/bookings" aria-describedby={titleId}>
            ไปชำระเงิน
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
      </>
    )
  }
  if (!course.registration_open) return <Unavailable>ปิดรับสมัคร</Unavailable>
  if (course.seats_taken >= course.capacity) return <Unavailable>เต็มแล้ว</Unavailable>
  return (
    <Button size="lg" className={bookButton()} aria-describedby={titleId} onClick={onBook}>
      ลงทะเบียน
    </Button>
  )
}

/** Sits where the booking button would be, for a course that cannot be booked right now. */
function Unavailable({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className={unavailable()}>
      {children}
    </p>
  )
}
