import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { bookingStatus, dateTime, holdsSeat } from '../lib/format'
import { fetchCourses, supabase, type Booking, type Course } from '../lib/supabase'

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

  if (!courses) return <p className="page-message">{error || 'กำลังโหลด…'}</p>

  const now = Date.now()
  return (
    <>
      <h1>รายชื่อผู้เรียน</h1>
      {courses.length === 0 && <p className="muted">ยังไม่มีคอร์สที่คุณเป็นผู้สอน</p>}

      <div className="stack">
        {courses.map((course) => {
          const students = bookings.filter((b) => b.course_id === course.id && holdsSeat(b, now))
          return (
            <section className="card stack" key={course.id}>
              <div className="card-head">
                <h2>{course.title}</h2>
                <span>
                  {students.length} / {course.capacity} คน
                </span>
              </div>
              {students.length === 0 ? (
                <p className="muted">ยังไม่มีผู้จอง</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ลำดับ</th>
                      <th>ชื่อผู้เรียน</th>
                      <th>สถานะ</th>
                      <th>จองเมื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => {
                      const status = bookingStatus(student, now)
                      return (
                        <tr key={student.id}>
                          <td>{index + 1}</td>
                          <td>{student.student_name}</td>
                          <td>
                            <span className={`tag ${status.tone}`}>{status.text}</span>
                          </td>
                          <td>{dateTime(student.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
