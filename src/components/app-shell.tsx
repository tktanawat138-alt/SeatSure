import type { ReactNode } from 'react'
import { BookOpen, CalendarCheck, LogOut, Settings, TriangleAlert, Users, type LucideIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { Logo } from '@/components/logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { supabase, type BookingMode, type Profile } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Role = Profile['role']

const roleLabels: Record<Role, string> = {
  parent: 'ผู้ปกครอง/นักเรียน',
  teacher: 'ครูผู้สอน',
  admin: 'แอดมินโรงเรียน',
}

const navItems: Record<Role, { to: string; label: string; icon: LucideIcon }[]> = {
  parent: [
    { to: '/', label: 'คอร์สเรียน', icon: BookOpen },
    { to: '/bookings', label: 'การจองของฉัน', icon: CalendarCheck },
  ],
  teacher: [{ to: '/', label: 'รายชื่อผู้เรียน', icon: Users }],
  admin: [{ to: '/', label: 'จัดการคอร์ส', icon: Settings }],
}

/** The frame around every signed-in page: top bar, demo-mode warning and page container. */
export function AppShell({
  profile,
  mode,
  children,
}: Readonly<{
  profile: Profile
  mode: BookingMode
  children: ReactNode
}>) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur print:hidden">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:py-0">
          <Link to="/" aria-label="SeatSure หน้าแรก">
            <Logo />
          </Link>

          <nav aria-label="เมนูหลัก" className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto">
            {navItems[profile.role].map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'bg-muted text-foreground',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <div className="flex items-center gap-2" data-slot="current-user">
              <Avatar size="sm">
                <AvatarFallback className="bg-primary/10 font-medium text-primary">
                  {Array.from(profile.full_name)[0] ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="text-sm font-medium">{profile.full_name}</p>
                <p className="hidden text-xs text-muted-foreground sm:block">{roleLabels[profile.role]}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
              <LogOut data-icon="inline-start" aria-hidden />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>

      {mode === 'unsafe' && (
        <div role="alert" className="border-b border-destructive/20 bg-destructive/10 print:hidden">
          <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2 text-sm font-medium text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            โหมดสาธิตบั๊กเปิดอยู่: ระบบไม่ล็อกที่นั่งและไม่ตรวจการจ่ายซ้ำ ห้ามใช้รับจองจริง
          </p>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  )
}
