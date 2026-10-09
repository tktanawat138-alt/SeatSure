import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { BookingMode } from '@/lib/supabase'
import * as s from './booking-mode-card.styles'

interface Props {
  mode: BookingMode
  busy: boolean
  /** Switches to the other mode. */
  onSwitch: () => void
}

export function BookingModeCard({ mode, busy, onSwitch }: Readonly<Props>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>โหมดการจอง (ใช้ตอนสาธิตเท่านั้น)</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className={s.body()}>
        <p>
          โหมดสาธิตบั๊กปิดการล็อกที่นั่งและการตรวจจ่ายซ้ำ เพื่อแสดงว่าชุดเทสจับปัญหาได้ คำสั่ง <Code>npm test</Code> และ{' '}
          <Code>npm run test:unsafe</Code> ตั้งโหมดเองและคืนเป็นปกติเมื่อรันจบ
        </p>
      </CardContent>
      <CardFooter className={s.footer()}>
        <p className={s.current()}>
          ตอนนี้: <ModeBadge mode={mode} />
        </p>
        <SwitchModeButton mode={mode} busy={busy} onSwitch={onSwitch} />
      </CardFooter>
    </Card>
  )
}

function Code({ children }: Readonly<{ children: ReactNode }>) {
  return <code className={s.code()}>{children}</code>
}

function ModeBadge({ mode }: Readonly<{ mode: BookingMode }>) {
  if (mode === 'safe') return <StatusBadge tone="ok">ปกติ ล็อกที่นั่งทุกครั้งที่จอง</StatusBadge>
  return <StatusBadge tone="bad">สาธิตบั๊ก ไม่ล็อกที่นั่ง</StatusBadge>
}

/** Going back to normal is immediate; turning the safeguards off asks first. */
function SwitchModeButton({ mode, busy, onSwitch }: Readonly<Props>) {
  if (mode === 'unsafe') {
    return (
      <Button disabled={busy} onClick={onSwitch}>
        กลับเป็นโหมดปกติ
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={busy}>
          เปลี่ยนเป็นโหมดสาธิตบั๊ก
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className={s.media()}>
            <TriangleAlert aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>เปิดโหมดสาธิตบั๊กใช่ไหม</AlertDialogTitle>
          <AlertDialogDescription>
            ระบบจะไม่ล็อกที่นั่งและไม่ตรวจการจ่ายซ้ำ จึงอาจมีการจองเกินจำนวนรับหรือจ่ายเงินซ้ำได้ ใช้ตอนสาธิตเท่านั้น
            และกลับเป็นโหมดปกติเมื่อสาธิตเสร็จ
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onSwitch}>
            เปิดโหมดสาธิตบั๊ก
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
