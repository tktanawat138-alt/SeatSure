import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth'
import { baht, errorText, holdsSeat } from '../lib/format'
import { fetchCourses, supabase, type Booking, type Course } from '../lib/supabase'

export default function CoursesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [openCourseId, setOpenCourseId] = useState<string | null>(null)
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

  async function bookSeat(event: FormEvent, course: Course) {
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

  /** What the parent can do with one course: open their booking, see why it is unavailable, or book it. */
  function renderAction(course: Course, mine: Booking | undefined) {
    if (mine?.status === 'paid') {
      return (
        <div className="row">
          <span className="tag ok">ชำระแล้ว</span>
          <Link to={`/receipt/${mine.id}`}>ดูใบเสร็จ</Link>
        </div>
      )
    }
    if (mine) {
      return (
        <div className="row">
          <span className="tag warn">จองไว้แล้ว รอชำระเงิน</span>
          <Link to="/bookings">ไปชำระเงิน</Link>
        </div>
      )
    }
    if (!course.registration_open) return <span className="tag muted">ปิดรับสมัคร</span>
    if (course.seats_taken >= course.capacity) return <span className="tag muted">เต็มแล้ว</span>
    if (openCourseId !== course.id) {
      return (
        <button
          className="primary"
          onClick={() => {
            setOpenCourseId(course.id)
            setError('')
          }}
        >
          จองที่นั่ง
        </button>
      )
    }
    return (
      <form className="stack" onSubmit={(event) => bookSeat(event, course)}>
        <label>
          ชื่อผู้เรียน
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
        </label>
        <p className="muted">ระบบจะล็อกที่นั่งให้ 10 นาทีเพื่อรอชำระเงิน</p>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="primary" disabled={busy}>
            ยืนยันการจอง
          </button>
          <button type="button" onClick={() => setOpenCourseId(null)}>
            ยกเลิก
          </button>
        </div>
      </form>
    )
  }

  if (!courses) return <p className="page-message">{error || 'กำลังโหลด…'}</p>

  const now = Date.now()
  return (
    <>
      <h1>คอร์สเรียนเสริม</h1>
      <div className="grid">
        {courses.map((course) => {
          const seatsLeft = course.capacity - course.seats_taken
          const mine = myBookings.find((b) => b.course_id === course.id && holdsSeat(b, now))

          return (
            <article className="card stack" key={course.id}>
              <div className="card-head">
                <h2>{course.title}</h2>
                <strong>{baht(course.price)}</strong>
              </div>
              <p className="muted">
                {course.teacher_name ? `สอนโดย ${course.teacher_name}` : 'ยังไม่ระบุผู้สอน'}
              </p>
              {course.description && <p>{course.description}</p>}
              <p>
                {seatsLeft > 0
                  ? `เหลือ ${seatsLeft} จาก ${course.capacity} ที่นั่ง`
                  : `เต็มแล้ว (รับ ${course.capacity} คน)`}
              </p>

              {renderAction(course, mine)}
            </article>
          )
        })}
      </div>
    </>
  )
}
