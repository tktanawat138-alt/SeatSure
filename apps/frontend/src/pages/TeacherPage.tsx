import { useEffect, useState } from 'react'
import { BookOpen, Users } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { EmptyState, PageError, PageLoading } from '@/components/page-state'
import { SeatMeter } from '@/components/seat-meter'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { bookingStatus, dateTime, holdsSeat } from '@/lib/format'
import { fetchCourses, supabase, type Booking, type Course } from '@/lib/supabase'

/** The booking time as two unbreakable parts, so a narrow column wraps between date and time and nowhere else. */
function BookedAt({ iso }: Readonly<{ iso: string }>) {
  const text = dateTime(iso)
  const cut = text.lastIndexOf(' ')
  if (cut < 0) return text
  return (
    <>
      <span className="whitespace-nowrap">{text.slice(0, cut)}</span>{' '}
      <span className="whitespace-nowrap">{text.slice(cut + 1)}</span>
    </>
  )
}

function RosterTable({ students, now }: Readonly<{ students: Booking[]; now: number }>) {
  return (
    <div className="border-t">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14 pl-4 text-muted-foreground">ลำดับ</TableHead>
            <TableHead className="text-muted-foreground">ชื่อผู้เรียน</TableHead>
            <TableHead className="text-muted-foreground">สถานะ</TableHead>
            <TableHead className="pr-4 text-right text-muted-foreground">จองเมื่อ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student, index) => {
            const status = bookingStatus(student, now)
            return (
              <TableRow key={student.id}>
                <TableCell className="pl-4 text-muted-foreground tabular-nums">{index + 1}</TableCell>
                <TableCell className="font-medium whitespace-normal">{student.student_name}</TableCell>
                <TableCell>
                  <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
                </TableCell>
                {/* On a phone this column is only as wide as the date, so the time sits on a second line. */}
                <TableCell className="w-px pr-4 text-right whitespace-normal text-muted-foreground tabular-nums sm:w-auto sm:whitespace-nowrap">
                  <BookedAt iso={student.created_at} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function CourseRoster({
  course,
  students,
  now,
}: Readonly<{ course: Course; students: Booking[]; now: number }>) {
  const hasStudents = students.length > 0
  return (
    <Card className={hasStudents ? 'pb-0' : undefined}>
      <CardHeader>
        <CardTitle>
          <h2>{course.title}</h2>
        </CardTitle>
        <CardAction>
          <Badge variant="secondary" className="tabular-nums">
            <Users aria-hidden />
            {students.length} / {course.capacity} คน
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <SeatMeter taken={students.length} capacity={course.capacity} hideCount />
      </CardContent>
      {hasStudents ? (
        <RosterTable students={students} now={now} />
      ) : (
        <CardContent>
          <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            ยังไม่มีผู้จอง
          </p>
        </CardContent>
      )}
    </Card>
  )
}

export default function TeacherPage() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [error, setError] = useState('')

  const teacherId = profile?.id
  useEffect(() => {
    if (!teacherId) return
    Promise.all([
      fetchCourses(teacherId),
      supabase.from('bookings').select().in('status', ['held', 'paid']).order('created_at'),
    ])
      .then(([courseList, roster]) => {
        setCourses(courseList)
        setBookings(roster.data ?? [])
      })
      .catch(() => setError('โหลดรายชื่อไม่สำเร็จ ลองโหลดหน้านี้ใหม่'))
  }, [teacherId])

  if (!courses) {
    if (error) return <PageError message={error} />
    return <PageLoading />
  }

  const now = Date.now()
  return (
    <>
      <PageHeader
        title="รายชื่อผู้เรียน"
        description="ผู้เรียนที่จองที่นั่งไว้ในแต่ละคอร์สที่คุณสอน"
      />

      {courses.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="ยังไม่มีคอร์สที่คุณเป็นผู้สอน"
          description="เมื่อแอดมินกำหนดให้คุณเป็นผู้สอน คอร์สและรายชื่อผู้เรียนจะแสดงที่นี่"
        />
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {courses.map((course) => (
          <CourseRoster
            key={course.id}
            course={course}
            students={bookings.filter((b) => b.course_id === course.id && holdsSeat(b, now))}
            now={now}
          />
        ))}
      </div>
    </>
  )
}
