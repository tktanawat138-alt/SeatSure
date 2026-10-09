import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarX2, CircleAlert, Clock, ReceiptText } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { EmptyState, PageError, PageLoading } from '@/components/page-state'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { baht, bookingStatus, countdown, dateTime, errorText, holdIsLive, useNow } from '@/lib/format'
import { supabase } from '@/lib/supabase'

async function fetchMyBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, courses(title, price), payments(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

type BookingRow = Awaited<ReturnType<typeof fetchMyBookings>>[number]

export default function MyBookingsPage() {
  const navigate = useNavigate()
  const now = useNow()
  const [bookings, setBookings] = useState<BookingRow[] | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  // One key per booking while this page is open, so a double click or a retry
  // repeats the same payment request instead of starting a second charge.
  const paymentKeys = useRef(new Map<string, string>())

  const load = useCallback(async () => {
    try {
      setBookings(await fetchMyBookings())
    } catch {
      setError('โหลดรายการจองไม่สำเร็จ ลองโหลดหน้านี้ใหม่')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function payFor(booking: BookingRow) {
    let key = paymentKeys.current.get(booking.id)
    if (!key) {
      key = crypto.randomUUID()
      paymentKeys.current.set(booking.id, key)
    }
    setPayingId(booking.id)
    setError('')
    const { data: payment, error } = await supabase.rpc('pay_booking', {
      p_booking_id: booking.id,
      p_idempotency_key: key,
    })
    setPayingId(null)
    if (error) {
      toast.error(errorText(error))
    } else if (payment.status === 'succeeded') {
      navigate(`/receipt/${booking.id}`)
      return
    }
    void load()
  }

  if (!bookings) return error ? <PageError message={error} /> : <PageLoading />

  return (
    <>
      <PageHeader title="การจองของฉัน" description="ดูสถานะการจอง ชำระเงิน และเปิดใบเสร็จได้จากหน้านี้" />

      {/* The list is already on screen, so a failed refresh is shown above it instead of replacing it. */}
      {error && (
        <div className="mb-4">
          <PageError message={error} />
        </div>
      )}

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="ยังไม่มีการจอง"
          description="เมื่อจองที่นั่งแล้ว รายการจองจะแสดงที่หน้านี้"
        >
          <Button asChild>
            <Link to="/">ดูคอร์สที่เปิดรับ</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <BookingCard
                booking={booking}
                now={now}
                paying={payingId === booking.id}
                onPay={() => payFor(booking)}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        การชำระเงินในระบบสาธิตนี้เป็นการจำลอง ไม่มีการตัดเงินจริง
      </p>
    </>
  )
}

function BookingCard({
  booking,
  now,
  paying,
  onPay,
}: Readonly<{
  booking: BookingRow
  now: number
  paying: boolean
  onPay: () => void
}>) {
  const status = bookingStatus(booking, now)
  const refund = booking.payments.find((p) => p.status === 'refund_due')

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-base font-medium">{booking.courses.title}</h2>
            <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
          </div>
          <p className="text-muted-foreground">
            ผู้เรียน {booking.student_name} · จองเมื่อ {dateTime(booking.created_at)}
          </p>
        </div>

        {booking.status === 'paid' && (
          <Button variant="outline" className="sm:shrink-0" asChild>
            <Link to={`/receipt/${booking.id}`}>
              <ReceiptText data-icon="inline-start" aria-hidden />
              ดูใบเสร็จ
            </Link>
          </Button>
        )}
        {holdIsLive(booking, now) && (
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center sm:gap-4">
            <p className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
              <Clock className="size-4 shrink-0" aria-hidden />
              เหลือเวลา {countdown(booking.hold_expires_at, now)} นาที
            </p>
            <Button size="lg" disabled={paying} aria-busy={paying} onClick={onPay}>
              {paying && <Spinner data-icon="inline-start" aria-hidden />}
              ชำระเงิน {baht(booking.courses.price)}
            </Button>
          </div>
        )}
      </CardContent>

      {refund && (
        <CardContent>
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <CircleAlert aria-hidden />
            <AlertTitle>ไม่ได้ที่นั่ง รอคืนเงิน</AlertTitle>
            <AlertDescription>
              เงิน {baht(refund.amount)} มาถึงหลังหมดเวลาและคอร์สเต็มแล้ว
              ระบบบันทึกรายการนี้ไว้เพื่อคืนเงิน (เลขที่ {refund.receipt_no})
            </AlertDescription>
          </Alert>
        </CardContent>
      )}
    </Card>
  )
}
