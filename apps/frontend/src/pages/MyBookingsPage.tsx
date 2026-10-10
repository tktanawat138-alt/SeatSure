import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { CalendarX2, CircleAlert, Check, ReceiptText, Upload } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { useAuth } from '@/lib/auth'
import { EmptyState, PageError, PageLoading } from '@/components/page-state'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { baht, bookingStatus, dateTime, errorText, holdIsLive, useNow } from '@/lib/format'
import type { MyBooking } from '@/entities/my-booking'
import { confirmPaymentProof, submitPaymentProof } from '@/app/deps'
import { DomainError } from '@/entities/domain-error'
import { loadMyBookings } from '@/app/deps'
import * as styles from './MyBookingsPage.styles'
import { useAutoRefresh } from '@/lib/use-auto-refresh'

type BookingRow = MyBooking

export default function MyBookingsPage() {
  const { session } = useAuth()
  const now = useNow()
  const [bookings, setBookings] = useState<BookingRow[] | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setBookings(await loadMyBookings())
    } catch {
      setError('โหลดรายการจองไม่สำเร็จ ลองโหลดหน้านี้ใหม่')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useAutoRefresh(load, 'bookings', 'payment_proofs', 'payments')

  async function uploadProof(booking: BookingRow, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!session?.user.id) { toast.error('กรุณาเข้าสู่ระบบใหม่'); return }
    setUploadingId(booking.id)
    try {
      await submitPaymentProof({ userId: session.user.id, bookingId: booking.id, file })
      toast.success('บันทึกหลักฐานแล้ว กรุณากดยืนยันการชำระเงิน')
      void load()
    } catch (cause) {
      const message = cause instanceof DomainError
        ? cause.code === 'proof_type_invalid' ? 'เลือกไฟล์ JPG, PNG หรือ WebP' : 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB'
        : errorText(cause instanceof Error ? cause : { message: 'payment_proof_upload_failed' })
      toast.error(message)
    } finally {
      setUploadingId(null)
      event.target.value = ''
    }
  }

  async function confirmPayment(booking: BookingRow) {
    setConfirmingId(booking.id)
    try {
      await confirmPaymentProof(booking.id)
      toast.success('ยืนยันการชำระเงินแล้ว')
      await load()
    } catch (cause) {
      toast.error(errorText(cause instanceof Error ? cause : { message: 'payment_confirmation_failed' }))
    } finally {
      setConfirmingId(null)
    }
  }

  if (!bookings) return error ? <PageError message={error} /> : <PageLoading />

  return (
    <>
      <PageHeader title="การจองของฉัน" description="ดูสถานะการจองและแนบหลักฐานการโอนเงินเข้าบัญชีโรงเรียน" />

      {/* The list is already on screen, so a failed refresh is shown above it instead of replacing it. */}
      {error && (
        <div className={styles.refreshError()}>
          <PageError message={error} />
        </div>
      )}

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="ยังไม่มีการจอง"
          description="เมื่อลงทะเบียนแล้ว รายการจะปรากฏที่หน้านี้"
        >
          <Button asChild>
            <Link to="/">ดูคอร์สที่เปิดรับ</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className={styles.list()}>
          {bookings.map((booking) => (
            <li key={booking.id}>
              <BookingCard
                booking={booking}
                now={now}
                uploading={uploadingId === booking.id}
                onUpload={(event) => void uploadProof(booking, event)}
                confirming={confirmingId === booking.id}
                onConfirm={() => void confirmPayment(booking)}
              />
            </li>
          ))}
        </ul>
      )}

      <p className={styles.footnote()}>บัญชีธนาคารที่แสดงเป็นข้อมูลตัวอย่างสำหรับสาธิตการโอนเงิน</p>
    </>
  )
}

function BookingCard({
  booking,
  now,
  uploading,
  onUpload,
  confirming,
  onConfirm,
}: Readonly<{
  booking: BookingRow
  now: number
  uploading: boolean
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  confirming: boolean
  onConfirm: () => void
}>) {
  const status = bookingStatus(booking, now)
  const refund = booking.payments.find((p) => p.status === 'refund_due')

  return (
    <Card>
      <CardContent className={styles.cardContent()}>
        <div className={styles.info()}>
          <div className={styles.titleRow()}>
            <h2 className={styles.title()}>{booking.courses.title}</h2>
            <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
          </div>
          <p className={styles.meta()}>
            ผู้เรียน {booking.student_name} · จองเมื่อ {dateTime(booking.created_at)}
          </p>
        </div>

        {booking.status === 'paid' && (
          <Button variant="outline" className={styles.receiptButton()} asChild>
            <Link to={`/receipt/${booking.id}`}>
              <ReceiptText data-icon="inline-start" aria-hidden />
              ดูใบเสร็จ
            </Link>
          </Button>
        )}
        {holdIsLive(booking, now) && (
          <div className={styles.payBox()}>
            <div className={styles.transferCard()}>
              <p className={styles.transferAmount()}>โอน {baht(booking.courses.price)} เข้าบัญชีโรงเรียน (ตัวอย่าง)</p>
              <p>ธนาคาร: ธนาคารตัวอย่าง</p><p>ชื่อบัญชี: โรงเรียน SeatSure</p><p>เลขที่บัญชี: 123-4-56789-0</p>
              {booking.payment_proofs.length > 0 && <p className={styles.paidProof()}>แนบหลักฐานแล้ว ยังไม่ได้ยืนยันการชำระเงิน</p>}
              <label className={styles.uploadLabel()}>
                <Upload className={styles.uploadIcon()} aria-hidden />{uploading ? 'กำลังอัปโหลด…' : booking.payment_proofs.length ? 'เปลี่ยนรูปหลักฐานการโอน' : 'แนบรูปหลักฐานการโอน'}
                <input className={styles.fileInput()} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || confirming} onChange={onUpload} />
              </label>
              {booking.payment_proofs.length > 0 && (
                <Button className={styles.confirmPayment()} disabled={confirming || uploading} onClick={onConfirm}>
                  <Check data-icon="inline-start" aria-hidden />{confirming ? 'กำลังยืนยัน…' : 'ยืนยันการชำระเงิน'}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {refund && (
        <CardContent>
          <Alert variant="destructive" className={styles.refundAlert()}>
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
