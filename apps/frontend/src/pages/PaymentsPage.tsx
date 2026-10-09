import { useCallback, useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PageError, PageLoading } from '@/components/page-state'
import { RefundReport } from '@/components/admin/refund-report'
import { type RosterView } from '@/components/admin/roster'
import { RosterDialog } from '@/components/admin/roster-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { dateTime } from '@/lib/format'
import type { Course } from '@/entities/course'
import type { RefundReport as RefundReportRow } from '@/entities/payment-system'
import { loadCourseRoster, loadPaymentSystem } from '@/app/deps'
import * as s from './PaymentsPage.styles'
import { useAutoRefresh } from '@/lib/use-auto-refresh'

export default function PaymentsPage() {
  const { session } = useAuth()
  const canViewProofs = session?.user.email?.toLowerCase() === 'admin01@seatsure.test'
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [refunds, setRefunds] = useState<RefundReportRow[]>([])
  const [error, setError] = useState('')
  const [roster, setRoster] = useState<RosterView | null>(null)
  const [rosterOpen, setRosterOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = await loadPaymentSystem()
      setCourses(result.courses)
      setRefunds(result.refunds)
    } catch {
      setError('โหลดข้อมูลระบบชำระเงินไม่สำเร็จ กรุณาลองใหม่')
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(load, 'courses', 'bookings', 'payments', 'payment_proofs')

  async function openRoster(course: Course) {
    setRoster({ course, rows: null, error: '' })
    setRosterOpen(true)
    try {
      setRoster({ course, rows: await loadCourseRoster(course.id), error: '' })
    } catch {
      setRoster({ course, rows: null, error: 'โหลดรายชื่อและหลักฐานการชำระเงินไม่สำเร็จ' })
    }
  }

  if (!courses) return error ? <PageError message={error} /> : <PageLoading />

  return (
    <>
      <PageHeader title="ระบบชำระเงิน" description="ดูสถานะการชำระเงินและหลักฐานการโอนของแต่ละคอร์ส รวมถึงรายงานคืนเงิน" />
      {error && <div className={s.error()}><PageError message={error} /></div>}
      <div className={s.stack()}>
        <Card>
          <CardHeader><CardTitle><h2>รายการชำระเงินตามคอร์ส</h2></CardTitle></CardHeader>
          <CardContent className={s.courseList()}>
            {courses.length === 0 ? <p className={s.courseMeta()}>ยังไม่มีคอร์ส</p> : courses.map((course) => (
              <div key={course.id} className={s.courseRow()}>
                <div className={s.courseInfo()}>
                  <p className={s.courseTitle()}>{course.title}</p>
                  <p className={s.courseMeta()}>{course.starts_at ? dateTime(course.starts_at) : 'ไม่ระบุวันเวลา'} · ผู้สอน {course.teacher_name ?? 'ไม่ระบุ'}</p>
                  <p className={s.courseCount()}>{course.seats_taken} / {course.capacity} ที่นั่งมีผู้จอง</p>
                </div>
                {canViewProofs && <Button variant="outline" onClick={() => void openRoster(course)}>
                  <Eye data-icon="inline-start" aria-hidden />รายชื่อและหลักฐานการชำระเงิน
                </Button>}
              </div>
            ))}
          </CardContent>
        </Card>
        <RefundReport rows={refunds} />
      </div>
      <RosterDialog roster={roster} open={rosterOpen} onOpenChange={setRosterOpen} onRetry={openRoster} />
    </>
  )
}
