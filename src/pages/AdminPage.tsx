import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import { baht, bookingStatus, errorText } from '../lib/format'
import { fetchCourses, supabase, type BookingMode, type Course, type Profile } from '../lib/supabase'

async function fetchRoster(courseId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, profiles(full_name), payments(*)')
    .eq('course_id', courseId)
    .order('created_at')
  if (error) throw error
  return data
}

type RosterRow = Awaited<ReturnType<typeof fetchRoster>>[number]

/** Money taken that does not match exactly one paid seat. */
function paymentProblem(row: RosterRow) {
  const charges = row.payments.filter((p) => p.status === 'succeeded').length
  if (charges > 1) return 'เก็บเงินซ้ำ'
  if (charges === 1 && row.status !== 'paid') return 'รับเงินแล้วแต่ไม่มีที่นั่ง'
  return null
}

const emptyCourse = { title: '', description: '', teacherId: '', capacity: '20', price: '0' }

interface Props {
  mode: BookingMode
  onModeChange: (mode: BookingMode) => void
}

export default function AdminPage({ mode, onModeChange }: Props) {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [draft, setDraft] = useState(emptyCourse)
  const [roster, setRoster] = useState<{ courseId: string; rows: RosterRow[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [courseList, teacherList] = await Promise.all([
        fetchCourses(),
        supabase.from('profiles').select().eq('role', 'teacher').order('full_name'),
      ])
      setCourses(courseList)
      setTeachers(teacherList.data ?? [])
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ ลองโหลดหน้านี้ใหม่')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Runs one change, shows its error if any, then refreshes the list. */
  async function run(change: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError('')
    const { error } = await change()
    if (error) setError(errorText(error))
    await load()
    setBusy(false)
    return !error
  }

  async function addCourse(event: FormEvent) {
    event.preventDefault()
    const added = await run(() =>
      supabase.from('courses').insert({
        title: draft.title.trim(),
        description: draft.description.trim(),
        teacher_id: draft.teacherId || null,
        capacity: Number(draft.capacity),
        price: Number(draft.price),
      }),
    )
    if (added) setDraft(emptyCourse)
  }

  function saveCapacity(event: FormEvent<HTMLFormElement>, course: Course) {
    event.preventDefault()
    const capacity = Number(new FormData(event.currentTarget).get('capacity'))
    void run(() => supabase.from('courses').update({ capacity }).eq('id', course.id))
  }

  const toggleRegistration = (course: Course) =>
    run(() =>
      supabase.from('courses').update({ registration_open: !course.registration_open }).eq('id', course.id),
    )

  async function toggleRoster(course: Course) {
    if (roster?.courseId === course.id) {
      setRoster(null)
      return
    }
    try {
      setRoster({ courseId: course.id, rows: await fetchRoster(course.id) })
    } catch {
      setError('โหลดรายชื่อไม่สำเร็จ ลองอีกครั้ง')
    }
  }

  async function switchMode() {
    const next: BookingMode = mode === 'safe' ? 'unsafe' : 'safe'
    const switched = await run(() =>
      supabase.from('app_settings').update({ booking_mode: next }).eq('id', true),
    )
    if (switched) onModeChange(next)
  }

  if (!courses) return <p className="page-message">{error || 'กำลังโหลด…'}</p>

  const now = Date.now()
  return (
    <>
      <h1>จัดการคอร์ส</h1>
      {error && <p className="error">{error}</p>}

      <section className="card stack">
        <h2>คอร์สทั้งหมด</h2>
        <table>
          <thead>
            <tr>
              <th>คอร์ส</th>
              <th>ที่นั่งที่จองแล้ว</th>
              <th>ราคา</th>
              <th>จำนวนรับ</th>
              <th>รับสมัคร</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => {
              const over = course.seats_taken - course.capacity
              return (
                <Fragment key={course.id}>
                  <tr>
                    <td>
                      <strong>{course.title}</strong>
                      <div className="muted">{course.teacher_name ?? 'ยังไม่ระบุผู้สอน'}</div>
                    </td>
                    <td>
                      {course.seats_taken} / {course.capacity}{' '}
                      {over > 0 && <span className="tag bad">จองเกิน {over} ที่นั่ง</span>}
                    </td>
                    <td>{baht(course.price)}</td>
                    <td>
                      <form className="row" onSubmit={(event) => saveCapacity(event, course)}>
                        <input
                          key={course.capacity}
                          className="narrow"
                          name="capacity"
                          type="number"
                          min={1}
                          defaultValue={course.capacity}
                          aria-label={`จำนวนรับของ ${course.title}`}
                          required
                        />
                        <button disabled={busy}>บันทึก</button>
                      </form>
                    </td>
                    <td>
                      <div className="row">
                        <span className={`tag ${course.registration_open ? 'ok' : 'muted'}`}>
                          {course.registration_open ? 'เปิดรับ' : 'ปิดรับ'}
                        </span>
                        <button disabled={busy} onClick={() => toggleRegistration(course)}>
                          {course.registration_open ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <button onClick={() => toggleRoster(course)}>
                        {roster?.courseId === course.id ? 'ซ่อนรายชื่อ' : 'รายชื่อและการชำระเงิน'}
                      </button>
                    </td>
                  </tr>

                  {roster?.courseId === course.id && (
                    <tr className="detail">
                      <td colSpan={6}>
                        {roster.rows.length === 0 ? (
                          <p className="muted">ยังไม่มีผู้จอง</p>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                <th>ผู้เรียน</th>
                                <th>บัญชีที่จอง</th>
                                <th>สถานะการจอง</th>
                                <th>การชำระเงิน</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roster.rows.map((row) => {
                                const status = bookingStatus(row, now)
                                const problem = paymentProblem(row)
                                return (
                                  <tr key={row.id}>
                                    <td>{row.student_name}</td>
                                    <td>{row.profiles.full_name}</td>
                                    <td>
                                      <span className={`tag ${status.tone}`}>{status.text}</span>
                                    </td>
                                    <td>
                                      {row.payments.length === 0 && <span className="muted">ยังไม่ชำระ</span>}
                                      {row.payments.map((payment) => (
                                        <div key={payment.id}>
                                          {payment.receipt_no} · {baht(payment.amount)} ·{' '}
                                          {payment.status === 'succeeded' ? 'รับเงินแล้ว' : 'ต้องคืนเงิน'}
                                        </div>
                                      ))}
                                      {problem && <span className="tag bad">{problem}</span>}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <h2>เพิ่มคอร์ส</h2>
        <form className="form-grid" onSubmit={addCourse}>
          <label>
            ชื่อคอร์ส
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
          </label>
          <label>
            ผู้สอน
            <select value={draft.teacherId} onChange={(e) => setDraft({ ...draft, teacherId: e.target.value })}>
              <option value="">ยังไม่ระบุ</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            รายละเอียด
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label>
            จำนวนรับ (คน)
            <input
              type="number"
              min={1}
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
              required
            />
          </label>
          <label>
            ราคา (บาท)
            <input
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            เพิ่มคอร์ส
          </button>
        </form>
      </section>

      <section className="card stack">
        <h2>โหมดการจอง (ใช้ตอนสาธิตเท่านั้น)</h2>
        <p>
          ตอนนี้:{' '}
          {mode === 'safe' ? (
            <span className="tag ok">ปกติ ล็อกที่นั่งทุกครั้งที่จอง</span>
          ) : (
            <span className="tag bad">สาธิตบั๊ก ไม่ล็อกที่นั่ง</span>
          )}
        </p>
        <p className="muted">
          โหมดสาธิตบั๊กปิดการล็อกที่นั่งและการตรวจจ่ายซ้ำ เพื่อแสดงว่าชุดเทสจับปัญหาได้
          คำสั่ง npm test และ npm run test:unsafe ตั้งโหมดเองและคืนเป็นปกติเมื่อรันจบ
        </p>
        <div>
          <button disabled={busy} onClick={switchMode}>
            {mode === 'safe' ? 'เปลี่ยนเป็นโหมดสาธิตบั๊ก' : 'กลับเป็นโหมดปกติ'}
          </button>
        </div>
      </section>
    </>
  )
}
