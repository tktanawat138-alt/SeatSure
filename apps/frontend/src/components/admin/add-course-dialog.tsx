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

export interface CourseDraft {
  title: string
  description: string
  teacherId: string
  capacity: string
  price: string
}

const emptyCourse: CourseDraft = { title: '', description: '', teacherId: '', capacity: '20', price: '0' }

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
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="leading-snug">เพิ่มคอร์ส</DialogTitle>
          <DialogDescription>คอร์สใหม่จะเปิดรับสมัครทันทีที่เพิ่ม</DialogDescription>
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
    if (await onAdd(draft, setError)) onAdded()
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-title`}>ชื่อคอร์ส</FieldLabel>
          <Input
            id={`${id}-title`}
            className="h-9"
            value={draft.title}
            onChange={(e) => change({ title: e.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-teacher`}>ผู้สอน</FieldLabel>
          <Select
            value={draft.teacherId || NO_TEACHER}
            onValueChange={(value) => change({ teacherId: value === NO_TEACHER ? '' : value })}
          >
            <SelectTrigger id={`${id}-teacher`} className="w-full data-[size=default]:h-9">
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
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-description`}>รายละเอียด</FieldLabel>
          <Textarea
            id={`${id}-description`}
            value={draft.description}
            onChange={(e) => change({ description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-capacity`}>จำนวนรับ (คน)</FieldLabel>
            <Input
              id={`${id}-capacity`}
              className="h-9 tabular-nums"
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
              className="h-9 tabular-nums"
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
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
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
