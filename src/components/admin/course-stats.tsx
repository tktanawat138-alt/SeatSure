import { Armchair, BookOpen, DoorOpen, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Course } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Stat {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  alert?: boolean
}

/** Headline numbers for the admin page, worked out from the courses already loaded. */
export function CourseStats({ courses }: Readonly<{ courses: Course[] }>) {
  const seatsTaken = courses.reduce((sum, course) => sum + course.seats_taken, 0)
  const capacity = courses.reduce((sum, course) => sum + course.capacity, 0)
  const filled = capacity > 0 ? Math.round((seatsTaken / capacity) * 100) : 0
  const open = courses.filter((course) => course.registration_open).length
  const overbooked = courses.filter((course) => course.seats_taken > course.capacity).length

  const stats: Stat[] = [
    { label: 'จำนวนคอร์ส', value: String(courses.length), hint: 'คอร์สที่มีในระบบ', icon: BookOpen },
    {
      label: 'ยอดจองรวม',
      value: `${seatsTaken} / ${capacity}`,
      hint: `ที่นั่ง หรือ ${filled}% ของจำนวนรับ`,
      icon: Armchair,
    },
    { label: 'เปิดรับสมัครอยู่', value: String(open), hint: `จาก ${courses.length} คอร์ส`, icon: DoorOpen },
    {
      label: 'คอร์สที่จองเกิน',
      value: String(overbooked),
      hint: overbooked > 0 ? 'เกินจำนวนรับ ควรตรวจสอบ' : 'ไม่มีคอร์สที่เกินจำนวนรับ',
      icon: TriangleAlert,
      alert: overbooked > 0,
    },
  ]

  return (
    <section aria-label="สรุปภาพรวม" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </section>
  )
}

function StatCard({ label, value, hint, icon: Icon, alert = false }: Readonly<Stat>) {
  return (
    <Card size="sm" className={cn(alert && 'bg-destructive/5 ring-destructive/30')}>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground">{label}</p>
          <Icon className={cn('size-4 shrink-0 text-muted-foreground', alert && 'text-destructive')} aria-hidden />
        </div>
        <p className={cn('text-2xl font-semibold tabular-nums', alert && 'text-destructive')}>{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
