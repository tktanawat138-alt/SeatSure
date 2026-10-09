import { useId, useState, type SubmitEvent } from 'react'
import { CircleAlert, Plus } from 'lucide-react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { Profile } from '@/lib/supabase'
import * as s from './add-course-dialog.styles'

export interface CourseDraft {
  title: string
  description: string
  teacherId: string
  capacity: string
  price: string
  startsAt: string
  endsAt: string
}

const emptyCourse: CourseDraft = {
  title: '',
  description: '',
  teacherId: '',
  capacity: '20',
  price: '0',
  startsAt: '',
  endsAt: '',
}

// A Radix SelectItem cannot have an empty value, so "no teacher" is this in the Select
// and '' in the draft.
const NO_TEACHER = 'none'

interface Props {
  teachers: Profile[]
  busy: boolean
  /** Saves the course. Resolves to true when added; otherwise reports why through `reportError`. */
  onAdd: (draft: CourseDraft, reportError: (message: string) => void) => Promise<boolean>
}

export function AddCourseDialog(props: Readonly<Props>) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" aria-hidden />
          เพิ่มคอร์ส
        </Button>
      </DialogTrigger>
      <DialogContent className={s.dialog()}>
        <DialogHeader className={s.header()}>
          <DialogTitle className={s.title()}>เพิ่มคอร์ส</DialogTitle>
          <DialogDescription>คอร์สจะส่งให้แอดมินโรงเรียนตรวจอนุมัติก่อนเปิดรับสมัคร</DialogDescription>
        </DialogHeader>
        {/* The form lives only while the dialog is open, so it starts empty every time. */}
        <AddCourseForm {...props} onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function AddCourseForm({ teachers, busy, onAdd, onAdded }: Readonly<Props & { onAdded: () => void }>) {
  const id = useId()
  const [draft, setDraft] = useState(emptyCourse)
  const [error, setError] = useState('')

  const change = (fields: Partial<CourseDraft>) => setDraft((current) => ({ ...current, ...fields }))

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setError('')
    if (new Date(draft.endsAt) <= new Date(draft.startsAt)) {
      setError('วันและเวลาสิ้นสุดต้องอยู่หลังวันและเวลาเริ่มต้น')
      return
    }
    if (await onAdd(draft, setError)) onAdded()
  }

  return (
    <form className={s.form()} onSubmit={submit}>
      <FieldGroup className={s.fields()}>
        <Field>
          <FieldLabel htmlFor={`${id}-title`}>ชื่อคอร์ส</FieldLabel>
          <Input
            id={`${id}-title`}
            className={s.input()}
            value={draft.title}
            onChange={(e) => change({ title: e.target.value })}
            required
          />
        </Field>
        {teachers.length > 1 && <Field>
          <FieldLabel htmlFor={`${id}-teacher`}>ผู้สอน</FieldLabel>
          <Select
            value={draft.teacherId || NO_TEACHER}
            onValueChange={(value) => change({ teacherId: value === NO_TEACHER ? '' : value })}
          >
            <SelectTrigger id={`${id}-teacher`} className={s.selectTrigger()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_TEACHER}>ยังไม่ระบุ</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>}
        <Field>
          <FieldLabel htmlFor={`${id}-description`}>รายละเอียด</FieldLabel>
          <Textarea
            id={`${id}-description`}
            value={draft.description}
            onChange={(e) => change({ description: e.target.value })}
          />
        </Field>
        <div className={s.pair()}>
          <Field>
            <FieldLabel htmlFor={`${id}-starts`}>เริ่มวันที่และเวลา</FieldLabel>
            <Input id={`${id}-starts`} type="datetime-local" value={draft.startsAt} onChange={(e) => change({ startsAt: e.target.value })} required />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-ends`}>สิ้นสุดวันที่และเวลา</FieldLabel>
            <Input id={`${id}-ends`} type="datetime-local" value={draft.endsAt} onChange={(e) => change({ endsAt: e.target.value })} required />
          </Field>
        </div>
        <div className={s.pair()}>
          <Field>
            <FieldLabel htmlFor={`${id}-capacity`}>จำนวนรับ (คน)</FieldLabel>
            <Input
              id={`${id}-capacity`}
              className={s.input({ numeric: true })}
              type="number"
              min={1}
              value={draft.capacity}
              onChange={(e) => change({ capacity: e.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-price`}>ราคา (บาท)</FieldLabel>
            <Input
              id={`${id}-price`}
              className={s.input({ numeric: true })}
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => change({ price: e.target.value })}
              required
            />
          </Field>
        </div>
      </FieldGroup>

      {error && (
        <Alert variant="destructive" className={s.errorAlert()}>
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
          เพิ่มคอร์ส
        </Button>
      </DialogFooter>
    </form>
  )
}
