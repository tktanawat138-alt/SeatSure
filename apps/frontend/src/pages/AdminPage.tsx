import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { CourseApprovalQueue } from '@/components/admin/course-approval-queue'
import { CancelCourseDialog } from '@/components/admin/cancel-course-dialog'
import { CourseStats } from '@/components/admin/course-stats'
import { CourseTable } from '@/components/admin/course-table'
import { type RosterView } from '@/components/admin/roster'
import { RosterDialog } from '@/components/admin/roster-dialog'
import { PageHeader } from '@/components/page-header'
import { EmptyState, PageError, PageLoading } from '@/components/page-state'
import { errorText } from '@/lib/format'
import * as styles from './AdminPage.styles'
import { fetchCourses, supabase, type Course } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { loadCourseRoster } from '@/app/deps'
import { useAutoRefresh } from '@/lib/use-auto-refresh'

type Change = () => PromiseLike<{ error: { message: string } | null }>

export default function AdminPage() {
  const { session } = useAuth()
  const canApproveCourses = session?.user.email?.toLowerCase() === 'admin01@seatsure.test'
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [pendingCourses, setPendingCourses] = useState<Course[]>([])
  const [courseToCancel, setCourseToCancel] = useState<Course | null>(null)
  const [roster, setRoster] = useState<RosterView | null>(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    try {
      const [courseList, pendingResult] = await Promise.all([
        fetchCourses(),
        supabase.from('courses').select('*').eq('approval_status', 'pending').order('created_at'),
      ])
      if (pendingResult.error) throw pendingResult.error
      setCourses(courseList)
      setPendingCourses((pendingResult.data ?? []).map((c) => ({ ...c, teacher_name: null, seats_taken: 0 })) as Course[])
    } catch {
      setLoadError('โหลดข้อมูลไม่สำเร็จ ลองโหลดหน้านี้ใหม่')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useAutoRefresh(load, 'courses', 'bookings', 'payments', 'payment_proofs')

  /** Runs one change, reports its error if any, then refreshes the list. */
  async function run(change: Change, reportError: (message: string) => void) {
    setBusy(true)
    setLoadError('')
    const { error } = await change()
    if (error) reportError(errorText(error))
    await load()
    setBusy(false)
    return !error
  }

  /** For one-click actions, whose result is shown as a toast. */
  async function runWithToast(change: Change, done: string) {
    const succeeded = await run(change, (message) => toast.error(message))
    if (succeeded) toast.success(done)
    return succeeded
  }

  async function reviewCourse(course: Course, approved: boolean) {
    await runWithToast(
      () => supabase.from('courses').update({ approval_status: approved ? 'approved' : 'rejected', registration_open: approved }).eq('id', course.id),
      approved ? 'อนุมัติคอร์สแล้ว' : 'ปฏิเสธคอร์สแล้ว',
    )
  }

  function saveCapacity(event: SubmitEvent<HTMLFormElement>, course: Course) {
    event.preventDefault()
    const capacity = Number(new FormData(event.currentTarget).get('capacity'))
    void runWithToast(() => supabase.from('courses').update({ capacity }).eq('id', course.id), 'บันทึกแล้ว')
  }

  const toggleRegistration = (course: Course) =>
    runWithToast(
      () => supabase.from('courses').update({ registration_open: !course.registration_open }).eq('id', course.id),
      course.registration_open ? 'ปิดรับสมัครแล้ว' : 'เปิดรับสมัครแล้ว',
    )

  async function openRoster(course: Course) {
    setRoster({ course, rows: null, error: '' })
    setRosterOpen(true)
    // An answer that arrives after another course was opened must not replace that one.
    const show = (result: Pick<RosterView, 'rows' | 'error'>) =>
      setRoster((shown) => (shown?.course.id === course.id ? { course, ...result } : shown))
    try {
      show({ rows: await loadCourseRoster(course.id), error: '' })
    } catch {
      show({ rows: null, error: 'โหลดรายชื่อไม่สำเร็จ ลองอีกครั้ง' })
    }
  }

  async function cancelCourse(course: Course, reason: string) {
    setBusy(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('cancel_course', {
      p_course_id: course.id,
      p_reason: reason,
    })
    if (error) {
      toast.error(errorText(error))
      setBusy(false)
      return false
    }
    await load()
    setCourseToCancel(null)
    toast.success(`ยกเลิกคอร์สแล้ว เพิ่มรายการคืนเงิน ${data ?? 0} รายการ`)
    setBusy(false)
    return true
  }

  if (!courses) {
    if (loadError) return <PageError message={loadError} />
    return <PageLoading />
  }

  return (
    <>
      <PageHeader
        title="จัดการคอร์ส"
        description="ปรับจำนวนรับ เปิดหรือปิดรับสมัคร และตรวจรายชื่อกับการชำระเงินของแต่ละคอร์ส"
      />

      <div className={styles.stack()}>
        {loadError && <PageError message={loadError} />}

        <CourseStats courses={courses} />

        {canApproveCourses && <CourseApprovalQueue courses={pendingCourses} busy={busy} onReview={(course, approved) => void reviewCourse(course, approved)} />}

        {courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="ยังไม่มีคอร์ส" description="กดปุ่มเพิ่มคอร์สด้านบนเพื่อสร้างคอร์สแรก" />
        ) : (
          <CourseTable
            courses={courses}
            busy={busy}
            onSaveCapacity={saveCapacity}
            onToggleRegistration={toggleRegistration}
            onOpenRoster={openRoster}
            onCancelCourse={setCourseToCancel}
          />
        )}

      </div>

      <RosterDialog roster={roster} open={rosterOpen} onOpenChange={setRosterOpen} onRetry={openRoster} />
      <CancelCourseDialog
        course={courseToCancel}
        open={courseToCancel !== null}
        busy={busy}
        onOpenChange={(open) => { if (!open) setCourseToCancel(null) }}
        onConfirm={cancelCourse}
      />
    </>
  )
}
