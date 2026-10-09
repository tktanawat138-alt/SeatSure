import { useEffect, useId, useState, type SubmitEvent } from 'react'
import { CalendarClock, CircleAlert, Pencil } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { courseSchedule } from '@/lib/format'
import type { Course } from '@/entities/course'
import * as s from './edit-course-schedule.styles'

function localDateTime(iso: string | null) {
  const date = iso ? new Date(iso) : new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function EditCourseSchedule({
  course,
  busy,
  onSave,
}: Readonly<{ course: Course; busy: boolean; onSave: (startsAt: string, endsAt: string) => Promise<boolean> }>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [startsAt, setStartsAt] = useState(localDateTime(course.starts_at))
  const [endsAt, setEndsAt] = useState(localDateTime(course.ends_at))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setStartsAt(localDateTime(course.starts_at))
    setEndsAt(localDateTime(course.ends_at))
    setError('')
  }, [open, course.starts_at, course.ends_at])

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('วันและเวลาสิ้นสุดต้องอยู่หลังวันและเวลาเริ่มต้น')
      return
    }
    if (await onSave(new Date(startsAt).toISOString(), new Date(endsAt).toISOString())) setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`เปลี่ยนวันเวลา ${course.title}`}>
          <Pencil data-icon="inline-start" aria-hidden />แก้วันเวลา
        </Button>
      </DialogTrigger>
      <DialogContent className={s.dialog()}>
        <DialogHeader className={s.header()}>
          <DialogTitle>เปลี่ยนวันและเวลาเรียน</DialogTitle>
          <DialogDescription>{course.title}{course.starts_at && course.ends_at ? ` · ${courseSchedule(course.starts_at, course.ends_at)}` : ''}</DialogDescription>
        </DialogHeader>
        <form className={s.form()} onSubmit={submit}>
          <FieldGroup className={s.fields()}>
            <div className={s.pair()}>
              <Field>
                <FieldLabel htmlFor={`${id}-starts`}>เริ่มเรียน</FieldLabel>
                <Input id={`${id}-starts`} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-ends`}>สิ้นสุด</FieldLabel>
                <Input id={`${id}-ends`} type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
              </Field>
            </div>
          </FieldGroup>
          {error && <Alert variant="destructive" className={s.error()}><CircleAlert aria-hidden /><AlertDescription>{error}</AlertDescription></Alert>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">ปิด</Button></DialogClose>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? <Spinner data-icon="inline-start" aria-hidden /> : <CalendarClock data-icon="inline-start" aria-hidden />}
              บันทึกวันเวลา
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
