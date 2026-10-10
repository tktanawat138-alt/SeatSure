import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { FullPageLoading, PageLoading } from '@/components/page-state'
import { useAuth } from '@/lib/auth'
import AdminPage from '@/pages/AdminPage'
import CoursesPage from '@/pages/CoursesPage'
import LoginPage from '@/pages/LoginPage'
import MyBookingsPage from '@/pages/MyBookingsPage'
import PaymentsPage from '@/pages/PaymentsPage'
import ReceiptPage from '@/pages/ReceiptPage'
import TeacherPage from '@/pages/TeacherPage'

// Loaded on demand: only admins open it, and it brings the chart library with it.
const QualityPage = lazy(() => import('@/ui/pages/QualityPage'))

export default function App() {
  const { session, profile, loading } = useAuth()

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
  if (profile.role === 'admin') home = <AdminPage />
  else if (profile.role === 'teacher') home = <TeacherPage />

  return (
    <AppShell profile={profile}>
      <Routes>
        <Route path="/" element={home} />
        {profile.role === 'parent' && <Route path="/bookings" element={<MyBookingsPage />} />}
        {profile.role === 'admin' && <Route path="/payments" element={<PaymentsPage />} />}
        {profile.role === 'admin' && (
          <Route
            path="/quality"
            element={
              <Suspense fallback={<PageLoading />}>
                <QualityPage />
              </Suspense>
            }
          />
        )}
        <Route path="/receipt/:bookingId" element={<ReceiptPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
