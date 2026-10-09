import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { FullPageLoading } from '@/components/page-state'
import { useAuth } from '@/lib/auth'
import { supabase, type BookingMode } from '@/lib/supabase'
import AdminPage from '@/pages/AdminPage'
import CoursesPage from '@/pages/CoursesPage'
import LoginPage from '@/pages/LoginPage'
import MyBookingsPage from '@/pages/MyBookingsPage'
import ReceiptPage from '@/pages/ReceiptPage'
import TeacherPage from '@/pages/TeacherPage'

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

  if (loading) return <FullPageLoading />
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
    <AppShell profile={profile} mode={mode}>
      <Routes>
        <Route path="/" element={home} />
        {profile.role === 'parent' && <Route path="/bookings" element={<MyBookingsPage />} />}
        <Route path="/receipt/:bookingId" element={<ReceiptPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
