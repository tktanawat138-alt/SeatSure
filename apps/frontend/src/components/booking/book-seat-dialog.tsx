import { useId, type SubmitEvent } from 'react'
import { CircleAlert, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { baht } from '@/lib/format'
import type { Course } from '@/lib/supabase'
import { alert, content, form, header, hint, hintIcon, input, price, title } from './book-seat-dialog.styles'

/** The form a parent confirms to hold a seat in one course. The page owns the state and the request. */
export function BookSeatDialog({
  course,
  open,
  onOpenChange,
  studentName,
  onStudentNameChange,
  busy,
  error,
  onSubmit,
}: Readonly<{
  course: Course | null
  open: boolean
  onOpenChange: (open: boolean) => void
  studentName: string
  onStudentNameChange: (name: string) => void
  busy: boolean
  error: string
  onSubmit: (event: SubmitEvent, course: Course) => void
}>) {
  const nameId = useId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={content()}>
        {course && (
          <form className={form()} onSubmit={(event) => onSubmit(event, course)}>
            {/* Right padding keeps a long course title clear of the close button. */}
            <DialogHeader className={header()}>
              <DialogTitle className={title()}>จองที่นั่ง {course.title}</DialogTitle>
              <DialogDescription>
                {course.teacher_name ? `สอนโดย ${course.teacher_name}` : 'ยังไม่ระบุผู้สอน'} · ค่าเรียน{' '}
                <span className={price()}>{baht(course.price)}</span>
              </DialogDescription>
            </DialogHeader>

            <Field>
              <FieldLabel htmlFor={nameId}>ชื่อผู้เรียน</FieldLabel>
              <Input
                id={nameId}
                className={input()}
                autoComplete="off"
                value={studentName}
                onChange={(e) => onStudentNameChange(e.target.value)}
                required
              />
            </Field>

            <p className={hint()}>
              <Clock className={hintIcon()} aria-hidden />
              ระบบจะล็อกที่นั่งให้ 10 นาทีเพื่อรอชำระเงิน
            </p>

            {error && (
              <Alert variant="destructive" className={alert()}>
                <CircleAlert aria-hidden />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  ยกเลิก
                </Button>
              </DialogClose>
              <Button type="submit" disabled={busy} aria-busy={busy}>
                {busy && <Spinner data-icon="inline-start" aria-hidden />}
                ยืนยันการจอง
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
