import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BookSeatDialog } from '@/components/booking/book-seat-dialog'
import { CourseCard } from '@/components/booking/course-card'
import { PageHeader } from '@/components/page-header'
import { EmptyState, PageError, PageLoading } from '@/components/page-state'
import { useAuth } from '@/lib/auth'
import { errorText, holdsSeat } from '@/lib/format'
import * as styles from './CoursesPage.styles'
import { bookSeat, listCourses, loadActiveBookings } from '@/app/deps'
import type { Course } from '@/entities/course'
import type { ActiveBooking } from '@/interfaces/bookings-gateway'
import { useAutoRefresh } from '@/lib/use-auto-refresh'

export default function CoursesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [myBookings, setMyBookings] = useState<ActiveBooking[]>([])
  // The course in the booking dialog. It stays set after the dialog closes,
  // so the dialog still has its content while it animates out.
  const [openCourse, setOpenCourse] = useState<Course | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [studentName, setStudentName] = useState(profile?.full_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [courseList, bookings] = await Promise.all([
        listCourses(),
        loadActiveBookings(),
      ])
      setCourses(courseList)
      setMyBookings(bookings)
    } catch {
      setError('โหลดรายการคอร์สไม่สำเร็จ ลองโหลดหน้านี้ใหม่')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useAutoRefresh(load)

  function openDialog(course: Course) {
    setOpenCourse(course)
    setDialogOpen(true)
    setError('')
  }

  async function submitBooking(event: SubmitEvent, course: Course) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await bookSeat({ courseId: course.id, studentName })
    } catch (cause) {
      setBusy(false)
      setError(errorText(cause instanceof Error ? cause : { message: 'book_seat_failed' }))
      void load()
      return
    }
    setBusy(false)
    navigate('/bookings')
  }

  if (!courses) return error ? <PageError message={error} /> : <PageLoading />

  const availableCourses = courses.filter((course) => !course.cancelled_at && course.approval_status === 'approved')
  const now = Date.now()
  return (
    <>
      <PageHeader
        title="คอร์สเรียนเสริม"
        description="เลือกคอร์สที่สนใจเพื่อลงทะเบียน แล้วโอนเงินเข้าบัญชีโรงเรียนและแนบหลักฐานจากหน้าการจองของฉัน"
      />

      {availableCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="ยังไม่มีคอร์สเรียน"
          description="เมื่อโรงเรียนเปิดคอร์สใหม่ คอร์สจะแสดงที่หน้านี้"
        />
      ) : (
        <ul className={styles.grid()}>
          {availableCourses.map((course) => (
            <li key={course.id} className={styles.item()}>
              <CourseCard
                course={course}
                mine={myBookings.find((b) => b.course_id === course.id && holdsSeat(b, now))}
                onBook={() => openDialog(course)}
              />
            </li>
          ))}
        </ul>
      )}

      <BookSeatDialog
        course={openCourse}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        studentName={studentName}
        onStudentNameChange={setStudentName}
        busy={busy}
        error={error}
        onSubmit={submitBooking}
      />
    </>
  )
}
