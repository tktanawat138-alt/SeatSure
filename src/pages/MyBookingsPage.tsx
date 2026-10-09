import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { baht, bookingStatus, countdown, dateTime, errorText, holdIsLive, useNow } from '../lib/format'
import { supabase } from '../lib/supabase'

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
      setError(errorText(error))
    } else if (payment.status === 'succeeded') {
      navigate(`/receipt/${booking.id}`)
      return
    }
    void load()
  }

  if (!bookings) return <p className="page-message">{error || 'กำลังโหลด…'}</p>

  return (
    <>
      <h1>การจองของฉัน</h1>
      {error && <p className="error">{error}</p>}
      {bookings.length === 0 && (
        <p className="muted">
          ยังไม่มีการจอง <Link to="/">ดูคอร์สที่เปิดรับ</Link>
        </p>
      )}

      <div className="stack">
        {bookings.map((booking) => {
          const status = bookingStatus(booking, now)
          const refund = booking.payments.find((p) => p.status === 'refund_due')

          return (
            <article className="card booking" key={booking.id}>
              <div>
                <h2>{booking.courses.title}</h2>
                <p className="muted">
                  ผู้เรียน {booking.student_name} · จองเมื่อ {dateTime(booking.created_at)}
                </p>
                {refund && (
                  <p className="error">
                    เงิน {baht(refund.amount)} มาถึงหลังหมดเวลาและคอร์สเต็มแล้ว
                    ระบบบันทึกรายการนี้ไว้เพื่อคืนเงิน (เลขที่ {refund.receipt_no})
                  </p>
                )}
              </div>

              <div className="booking-side">
                <span className={`tag ${status.tone}`}>{status.text}</span>
                {booking.status === 'paid' && <Link to={`/receipt/${booking.id}`}>ดูใบเสร็จ</Link>}
                {holdIsLive(booking, now) && (
                  <>
                    <span className="muted">เหลือเวลา {countdown(booking.hold_expires_at, now)} นาที</span>
                    <button
                      className="primary"
                      disabled={payingId === booking.id}
                      onClick={() => payFor(booking)}
                    >
                      ชำระเงิน {baht(booking.courses.price)}
                    </button>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <p className="muted">การชำระเงินในระบบสาธิตนี้เป็นการจำลอง ไม่มีการตัดเงินจริง</p>
    </>
  )
}
