import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { baht, dateTime } from '../lib/format'
import { supabase } from '../lib/supabase'

async function fetchReceipt(bookingId: string) {
  const { data } = await supabase
    .from('bookings')
    .select('*, courses(title), payments(*)')
    .eq('id', bookingId)
    .maybeSingle()
  return data
}

type Receipt = NonNullable<Awaited<ReturnType<typeof fetchReceipt>>>

export default function ReceiptPage() {
  const { bookingId = '' } = useParams()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchReceipt(bookingId).then((data) => {
      setReceipt(data)
      setLoaded(true)
    })
  }, [bookingId])

  if (!loaded) return <p className="page-message">กำลังโหลด…</p>

  const payment = receipt?.payments.find((p) => p.status === 'succeeded') ?? receipt?.payments[0]
  if (!receipt || !payment) {
    return (
      <p className="page-message">
        ไม่พบใบเสร็จนี้ <Link to="/">กลับหน้าแรก</Link>
      </p>
    )
  }

  let status = { text: 'รับเงินแล้วแต่ยังไม่ยืนยันที่นั่ง ติดต่อโรงเรียน', tone: 'bad' }
  if (payment.status === 'refund_due') {
    status = { text: 'ไม่ได้ที่นั่ง รอคืนเงิน', tone: 'bad' }
  } else if (receipt.status === 'paid') {
    status = { text: 'ชำระแล้ว ยืนยันที่นั่งแล้ว', tone: 'ok' }
  }

  return (
    <article className="card receipt stack">
      <h1>ใบยืนยันการจองและใบเสร็จรับเงิน</h1>
      <dl>
        <dt>เลขที่ใบเสร็จ</dt>
        <dd>{payment.receipt_no}</dd>
        <dt>วันที่ชำระ</dt>
        <dd>{dateTime(payment.created_at)}</dd>
        <dt>ผู้เรียน</dt>
        <dd>{receipt.student_name}</dd>
        <dt>คอร์ส</dt>
        <dd>{receipt.courses.title}</dd>
        <dt>จำนวนเงิน</dt>
        <dd>{baht(payment.amount)}</dd>
        <dt>สถานะ</dt>
        <dd>
          <span className={`tag ${status.tone}`}>{status.text}</span>
        </dd>
      </dl>
      <p className="muted">การชำระเงินในระบบสาธิตนี้เป็นการจำลอง ไม่มีการตัดเงินจริง</p>
      <div className="row no-print">
        <button className="primary" onClick={() => window.print()}>
          พิมพ์
        </button>
        <Link to="/">กลับหน้าแรก</Link>
      </div>
    </article>
  )
}
