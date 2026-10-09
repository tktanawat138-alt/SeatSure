import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Course } from '@/lib/supabase'
import * as s from './course-approval-queue.styles'

export function CourseApprovalQueue({
  courses,
  busy,
  onReview,
}: Readonly<{ courses: Course[]; busy: boolean; onReview: (course: Course, approved: boolean) => void }>) {
  return (
    <Card>
      <CardHeader><CardTitle><h2>คอร์สรออนุมัติจากครู</h2></CardTitle></CardHeader>
      <CardContent className={s.list()}>
        {courses.length === 0 ? <p className={s.description()}>ไม่มีคอร์สรออนุมัติ</p> : courses.map((course) => (
          <div key={course.id} className={s.item()}>
            <div className={s.info()}>
              <p className={s.title()}>{course.title}</p>
              <p className={s.description()}>{course.description}</p>
              <p className={s.meta()}>{course.starts_at ? new Date(course.starts_at).toLocaleString('th-TH') : ''} · {course.capacity} คน · {course.price} บาท</p>
            </div>
            <div className={s.actions()}>
              <Button disabled={busy} onClick={() => onReview(course, true)}>อนุมัติ</Button>
              <Button disabled={busy} variant="outline" onClick={() => onReview(course, false)}>ปฏิเสธ</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
