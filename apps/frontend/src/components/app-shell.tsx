import type { ReactNode } from 'react'
import { BookOpen, CalendarCheck, LogOut, Settings, TriangleAlert, Users, type LucideIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { Logo } from '@/components/logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { supabase, type BookingMode, type Profile } from '@/lib/supabase'
import {
  avatarFallback,
  bar,
  header,
  main,
  nav,
  navIcon,
  navLink,
  root,
  user,
  userInfo,
  userName,
  userRole,
  userText,
  warning,
  warningIcon,
  warningText,
} from './app-shell.styles'

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
    <div className={root()}>
      <header className={header()}>
        <div className={bar()}>
          <Link to="/" aria-label="SeatSure หน้าแรก">
            <Logo />
          </Link>

          <nav aria-label="เมนูหลัก" className={nav()}>
            {navItems[profile.role].map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => navLink({ active: isActive })}
              >
                <Icon className={navIcon()} aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className={user()}>
            <div className={userInfo()} data-slot="current-user">
              <Avatar size="sm">
                <AvatarFallback className={avatarFallback()}>
                  {Array.from(profile.full_name)[0] ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className={userText()}>
                <p className={userName()}>{profile.full_name}</p>
                <p className={userRole()}>{roleLabels[profile.role]}</p>
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
        <div role="alert" className={warning()}>
          <p className={warningText()}>
            <TriangleAlert className={warningIcon()} aria-hidden />
            โหมดสาธิตบั๊กเปิดอยู่: ระบบไม่ล็อกที่นั่งและไม่ตรวจการจ่ายซ้ำ ห้ามใช้รับจองจริง
          </p>
        </div>
      )}

      <main className={main()}>{children}</main>
    </div>
  )
}
