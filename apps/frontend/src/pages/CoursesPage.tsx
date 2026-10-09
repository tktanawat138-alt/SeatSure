import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BookSeatDialog } from '@/components/booking/book-seat-dialog'
import { CourseCard } from '@/components/booking/course-card'
import { PageHeader } from '@/components/page-header'
import { EmptyState, PageError, PageLoading } from '@/components/page-state'
import { useAuth } from '@/lib/auth'
import { errorText, holdsSeat } from '@/lib/format'
import { fetchCourses, supabase, type Booking, type Course } from '@/lib/supabase'

export default function CoursesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [myBookings, setMyBookings] = useState<Booking[]>([])
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
        fetchCourses(),
        supabase.from('bookings').select().in('status', ['held', 'paid']),
      ])
      setCourses(courseList)
      setMyBookings(bookings.data ?? [])
    } catch {
      setError('โหลดรายการคอร์สไม่สำเร็จ ลองโหลดหน้านี้ใหม่')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openDialog(course: Course) {
    setOpenCourse(course)
    setDialogOpen(true)
    setError('')
  }

  async function bookSeat(event: SubmitEvent, course: Course) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('book_seat', {
      p_course_id: course.id,
      p_student_name: studentName,
    })
    setBusy(false)
    if (error) {
      setError(errorText(error))
      void load()
      return
    }
    navigate('/bookings')
  }

  if (!courses) return error ? <PageError message={error} /> : <PageLoading />

  const now = Date.now()
  return (
    <>
      <PageHeader
        title="คอร์สเรียนเสริม"
        description="เลือกคอร์สที่สนใจแล้วจองที่นั่ง จากนั้นชำระเงินภายใน 10 นาทีเพื่อยืนยันที่นั่ง"
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="ยังไม่มีคอร์สเรียน"
          description="เมื่อโรงเรียนเปิดคอร์สใหม่ คอร์สจะแสดงที่หน้านี้"
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id} className="flex">
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
        onSubmit={bookSeat}
      />
    </>
  )
}
