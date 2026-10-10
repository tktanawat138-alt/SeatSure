import { useState, type SubmitEvent } from 'react'
import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { Course } from '@/entities/course'
import * as s from './cancel-course-dialog.styles'

interface Props {
  course: Course | null
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (course: Course, reason: string) => Promise<boolean>
}

export function CancelCourseDialog({ course, open, busy, onOpenChange, onConfirm }: Readonly<Props>) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!course) return
    setError('')
    if (await onConfirm(course, reason.trim())) {
      setReason('')
      onOpenChange(false)
    } else {
      setError('ยกเลิกคอร์สไม่สำเร็จ กรุณาลองใหม่')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          if (!next) setReason('')
          if (!next) setError('')
          onOpenChange(next)
        }
      }}
    >
      <DialogContent className={s.dialog()}>
        <DialogHeader>
          <DialogTitle>ยืนยันการยกเลิกคอร์ส</DialogTitle>
          <DialogDescription>
            {course?.title} จะปิดรับจองทันที ผู้จองที่ชำระเงินแล้วจะถูกเพิ่มในรายงานคืนเงิน ส่วนการโอนเงินคืนต้องดำเนินการแยกต่างหาก
          </DialogDescription>
        </DialogHeader>
        <form className={s.form()} onSubmit={submit}>
          <Field>
            <FieldLabel htmlFor="cancel-course-reason">เหตุผลที่ยกเลิก</FieldLabel>
            <Textarea
              id="cancel-course-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              required
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              กลับ
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !reason.trim()} aria-busy={busy}>
              {busy && <Spinner data-icon="inline-start" aria-hidden />}
              ยืนยันยกเลิกคอร์ส
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
