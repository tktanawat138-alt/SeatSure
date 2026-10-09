import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router'
import { useAuth } from './lib/auth'
import { supabase, type BookingMode, type Profile } from './lib/supabase'
import AdminPage from './pages/AdminPage'
import CoursesPage from './pages/CoursesPage'
import LoginPage from './pages/LoginPage'
import MyBookingsPage from './pages/MyBookingsPage'
import ReceiptPage from './pages/ReceiptPage'
import TeacherPage from './pages/TeacherPage'

const roleLabels: Record<Profile['role'], string> = {
  parent: 'ผู้ปกครอง/นักเรียน',
  teacher: 'ครูผู้สอน',
  admin: 'แอดมินโรงเรียน',
}

export default function App() {
  const { session, profile, loading } = useAuth()
  const [mode, setMode] = useState<BookingMode>('safe')

  const signedIn = Boolean(session && profile)
  useEffect(() => {
    if (!signedIn) return
    supabase
      .from('app_settings')
      .select('booking_mode')
      .single()
      .then(({ data }) => setMode(data?.booking_mode === 'unsafe' ? 'unsafe' : 'safe'))
  }, [signedIn])

  if (loading) return <p className="page-message">กำลังโหลด…</p>
  if (!session || !profile) {
    // Signing out returns to "/", so the next account does not land on the
    // previous account's page (e.g. a receipt it is not allowed to see).
    return (
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  let home = <CoursesPage />
  if (profile.role === 'admin') home = <AdminPage mode={mode} onModeChange={setMode} />
  else if (profile.role === 'teacher') home = <TeacherPage />

  return (
    <>
      <header className="topbar">
        <span className="brand">SeatSure</span>
        <nav>
          {profile.role === 'parent' && (
            <>
              <NavLink to="/" end>
                คอร์สเรียน
              </NavLink>
              <NavLink to="/bookings">การจองของฉัน</NavLink>
            </>
          )}
          {profile.role === 'teacher' && (
            <NavLink to="/" end>
              รายชื่อผู้เรียน
            </NavLink>
          )}
          {profile.role === 'admin' && (
            <NavLink to="/" end>
              จัดการคอร์ส
            </NavLink>
          )}
        </nav>
        <span className="who">
          {profile.full_name} · {roleLabels[profile.role]}
        </span>
        <button className="link" onClick={() => supabase.auth.signOut()}>
          ออกจากระบบ
        </button>
      </header>

      {mode === 'unsafe' && (
        <p className="banner">
          โหมดสาธิตบั๊กเปิดอยู่: ระบบไม่ล็อกที่นั่งและไม่ตรวจการจ่ายซ้ำ ห้ามใช้รับจองจริง
        </p>
      )}

      <main>
        <Routes>
          <Route path="/" element={home} />
          {profile.role === 'parent' && <Route path="/bookings" element={<MyBookingsPage />} />}
          <Route path="/receipt/:bookingId" element={<ReceiptPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
