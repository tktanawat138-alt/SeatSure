import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { AddCourseDialog, type CourseDraft } from '@/components/admin/add-course-dialog'
import { BookingModeCard } from '@/components/admin/booking-mode-card'
import { CourseStats } from '@/components/admin/course-stats'
import { CourseTable } from '@/components/admin/course-table'
import { fetchRoster, type RosterView } from '@/components/admin/roster'
import { RosterDialog } from '@/components/admin/roster-dialog'
import { PageHeader } from '@/components/page-header'
import { EmptyState, PageError, PageLoading } from '@/components/page-state'
import { errorText } from '@/lib/format'
import { fetchCourses, supabase, type BookingMode, type Course, type Profile } from '@/lib/supabase'

type Change = () => PromiseLike<{ error: { message: string } | null }>

interface Props {
  mode: BookingMode
  onModeChange: (mode: BookingMode) => void
}

export default function AdminPage({ mode, onModeChange }: Readonly<Props>) {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [roster, setRoster] = useState<RosterView | null>(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    try {
      const [courseList, teacherList] = await Promise.all([
        fetchCourses(),
        supabase.from('profiles').select().eq('role', 'teacher').order('full_name'),
      ])
      setCourses(courseList)
      setTeachers(teacherList.data ?? [])
    } catch {
      setLoadError('โหลดข้อมูลไม่สำเร็จ ลองโหลดหน้านี้ใหม่')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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

  /** The add-course form shows its own error, so it passes in where to report it. */
  async function addCourse(draft: CourseDraft, reportError: (message: string) => void) {
    const added = await run(
      () =>
        supabase.from('courses').insert({
          title: draft.title.trim(),
          description: draft.description.trim(),
          teacher_id: draft.teacherId || null,
          capacity: Number(draft.capacity),
          price: Number(draft.price),
        }),
      reportError,
    )
    if (added) toast.success('เพิ่มคอร์สแล้ว')
    return added
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
      show({ rows: await fetchRoster(course.id), error: '' })
    } catch {
      show({ rows: null, error: 'โหลดรายชื่อไม่สำเร็จ ลองอีกครั้ง' })
    }
  }

  async function switchMode() {
    const next: BookingMode = mode === 'safe' ? 'unsafe' : 'safe'
    const switched = await runWithToast(
      () => supabase.from('app_settings').update({ booking_mode: next }).eq('id', true),
      next === 'safe' ? 'กลับเป็นโหมดปกติแล้ว' : 'เปิดโหมดสาธิตบั๊กแล้ว',
    )
    if (switched) onModeChange(next)
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
      >
        <AddCourseDialog teachers={teachers} busy={busy} onAdd={addCourse} />
      </PageHeader>

      <div className="space-y-4">
        {loadError && <PageError message={loadError} />}

        <CourseStats courses={courses} />

        {courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="ยังไม่มีคอร์ส" description="กดปุ่มเพิ่มคอร์สด้านบนเพื่อสร้างคอร์สแรก" />
        ) : (
          <CourseTable
            courses={courses}
            busy={busy}
            onSaveCapacity={saveCapacity}
            onToggleRegistration={toggleRegistration}
            onOpenRoster={openRoster}
          />
        )}

        <BookingModeCard mode={mode} busy={busy} onSwitch={switchMode} />
      </div>

      <RosterDialog roster={roster} open={rosterOpen} onOpenChange={setRosterOpen} onRetry={openRoster} />
    </>
  )
}
