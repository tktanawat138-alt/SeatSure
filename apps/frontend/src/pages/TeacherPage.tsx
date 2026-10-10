import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Users } from 'lucide-react'
import { toast } from 'sonner'
import { AddCourseDialog, type CourseDraft } from '@/components/admin/add-course-dialog'
import { EditCourseSchedule } from '@/components/teacher/edit-course-schedule'
import { PageHeader } from '@/components/page-header'
import { EmptyState, PageError, PageLoading } from '@/components/page-state'
import { SeatMeter } from '@/components/seat-meter'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { bookingStatus, courseSchedule, dateTime, errorText, holdsSeat } from '@/lib/format'
import * as styles from './TeacherPage.styles'
import type { Course } from '@/lib/supabase'
import type { ActiveBooking } from '@/interfaces/bookings-gateway'
import { createCourse, listCourses, loadActiveBookings, updateCourseSchedule } from '@/app/deps'
import { useAutoRefresh } from '@/lib/use-auto-refresh'

/** A thrown DomainError carries the API error code as its message, which `errorText` maps to Thai. */
const failureText = (cause: unknown, fallback = 'unknown_error') => errorText(cause instanceof Error ? cause : { message: fallback })

/** The booking time as two unbreakable parts, so a narrow column wraps between date and time and nowhere else. */
function BookedAt({ iso }: Readonly<{ iso: string }>) {
  const text = dateTime(iso)
  const cut = text.lastIndexOf(' ')
  if (cut < 0) return text
  return (
    <>
      <span className={styles.nowrap()}>{text.slice(0, cut)}</span>{' '}
      <span className={styles.nowrap()}>{text.slice(cut + 1)}</span>
    </>
  )
}

function RosterTable({ students, now }: Readonly<{ students: ActiveBooking[]; now: number }>) {
  return (
    <div className={styles.rosterWrap()}>
      <Table>
        <TableHeader className={styles.tableHeader()}>
          <TableRow className={styles.headRow()}>
            <TableHead className={styles.headCell({ column: 'rank' })}>ลำดับ</TableHead>
            <TableHead className={styles.headCell({ column: 'name' })}>ชื่อผู้เรียน</TableHead>
            <TableHead className={styles.headCell({ column: 'status' })}>สถานะ</TableHead>
            <TableHead className={styles.headCell({ column: 'time' })}>จองเมื่อ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student, index) => {
            const status = bookingStatus(student, now)
            return (
              <TableRow key={student.id}>
                <TableCell className={styles.cell({ column: 'rank' })}>{index + 1}</TableCell>
                <TableCell className={styles.cell({ column: 'name' })}>{student.student_name}</TableCell>
                <TableCell>
                  <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
                </TableCell>
                {/* On a phone this column is only as wide as the date, so the time sits on a second line. */}
                <TableCell className={styles.cell({ column: 'time' })}>
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
  scheduleBusy,
  onSaveSchedule,
}: Readonly<{ course: Course; students: ActiveBooking[]; now: number; scheduleBusy: boolean; onSaveSchedule: (startsAt: string, endsAt: string) => Promise<boolean> }>) {
  const hasStudents = students.length > 0
  return (
    <Card className={styles.courseCard({ hasStudents })}>
      <CardHeader>
        <CardTitle>
          <h2>{course.title}</h2>
        </CardTitle>
        <CardAction>
          <div className={styles.courseActions()}>
            <Badge variant="secondary" className={styles.countBadge()}>
              <Users aria-hidden />
              {students.length} / {course.capacity} คน
            </Badge>
            <EditCourseSchedule course={course} busy={scheduleBusy} onSave={onSaveSchedule} />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {course.starts_at && course.ends_at && <p className={styles.courseSchedule()}>{courseSchedule(course.starts_at, course.ends_at)}</p>}
        <SeatMeter taken={students.length} capacity={course.capacity} hideCount />
      </CardContent>
      {hasStudents ? (
        <RosterTable students={students} now={now} />
      ) : (
        <CardContent>
          <p className={styles.emptyNote()}>
            <Users className={styles.emptyIcon()} aria-hidden />
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
  const [bookings, setBookings] = useState<ActiveBooking[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null)

  const teacherId = profile?.id
  const refresh = useCallback(async () => {
    if (!teacherId) return
    try {
      const [courseList, roster] = await Promise.all([listCourses({ mine: true }), loadActiveBookings()])
      // The API lists cancelled courses too; this page hides them.
      setCourses(courseList.filter((course) => !course.cancelled_at))
      setBookings(roster)
      setError('')
    } catch {
      setError('โหลดรายชื่อไม่สำเร็จ ลองโหลดหน้านี้ใหม่')
    }
  }, [teacherId])

  useEffect(() => { void refresh() }, [refresh])
  useAutoRefresh(refresh)

  const addCourse = useCallback(async (draft: CourseDraft, reportError: (message: string) => void) => {
    if (!teacherId) return false
    setBusy(true)
    try {
      await createCourse(draft)
    } catch (cause) {
      setBusy(false)
      reportError(failureText(cause))
      return false
    }
    setBusy(false)
    toast.success('ส่งคอร์สให้แอดมินโรงเรียนอนุมัติแล้ว')
    await refresh()
    return true
  }, [teacherId, refresh])

  async function saveSchedule(course: Course, startsAt: string, endsAt: string) {
    setSavingScheduleId(course.id)
    try {
      await updateCourseSchedule(course.id, startsAt, endsAt)
      setCourses((current) => current?.map((item) => item.id === course.id ? { ...item, starts_at: startsAt, ends_at: endsAt } : item) ?? null)
      toast.success('เปลี่ยนวันเวลาเรียนแล้ว')
      return true
    } catch (cause) {
      toast.error(failureText(cause, 'course_schedule_update_failed'))
      return false
    } finally {
      setSavingScheduleId(null)
    }
  }

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
      >
        {profile && <AddCourseDialog teachers={[profile]} busy={busy} onAdd={addCourse} />}
      </PageHeader>

      {courses.some((course) => course.approval_status !== 'approved') && (
        <div className={styles.approvalSummary()}>
          {courses.filter((course) => course.approval_status === 'pending').length} คอร์สรอแอดมินอนุมัติ · {courses.filter((course) => course.approval_status === 'rejected').length} คอร์สถูกปฏิเสธ
        </div>
      )}

      {courses.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="ยังไม่มีคอร์สที่คุณเป็นผู้สอน"
          description="เมื่อแอดมินกำหนดให้คุณเป็นผู้สอน คอร์สและรายชื่อผู้เรียนจะแสดงที่นี่"
        />
      )}

      <div className={styles.grid()}>
        {courses.map((course) => (
          <CourseRoster
            key={course.id}
            course={course}
            students={bookings.filter((b) => b.course_id === course.id && holdsSeat(b, now))}
            now={now}
            scheduleBusy={savingScheduleId === course.id}
            onSaveSchedule={(startsAt, endsAt) => saveSchedule(course, startsAt, endsAt)}
          />
        ))}
      </div>
    </>
  )
}
