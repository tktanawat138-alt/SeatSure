import type { ReactNode } from 'react'
import { Banknote, BookOpen, CalendarCheck, LogOut, Settings, Users, type LucideIcon } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/deps'
import type { AuthProfile } from '@/lib/auth'
import {
  avatarFallback,
  bar,
  content,
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
} from './app-shell.styles'

type Role = AuthProfile['role']

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
  admin: [
    { to: '/', label: 'จัดการคอร์ส', icon: Settings },
    { to: '/payments', label: 'ระบบชำระเงิน', icon: Banknote },
  ],
}

/** The frame around every signed-in page: top bar and page container. */
export function AppShell({
  profile,
  children,
}: Readonly<{
  profile: AuthProfile
  children: ReactNode
}>) {
  const { pathname } = useLocation()

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
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut data-icon="inline-start" aria-hidden />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>

      <main className={main()}>
        <div key={pathname} className={content()}>
          {children}
        </div>
      </main>
    </div>
  )
}
