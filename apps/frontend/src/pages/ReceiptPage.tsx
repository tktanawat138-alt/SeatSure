import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Logo } from '@/components/logo'
import { EmptyState } from '@/components/page-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { baht, dateTime, type Tone } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import * as styles from './ReceiptPage.styles'

async function fetchReceipt(bookingId: string) {
  const { data } = await supabase
    .from('bookings')
    .select('*, courses(title), payments(*)')
    .eq('id', bookingId)
    .maybeSingle()
  return data
}

type Receipt = NonNullable<Awaited<ReturnType<typeof fetchReceipt>>>

function ReceiptRow({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className={styles.row()}>
      <dt className={styles.rowLabel()}>{label}</dt>
      <dd className={styles.rowValue()}>{children}</dd>
    </div>
  )
}

function ReceiptSkeleton() {
  return (
    <div className={styles.skeletonWrap()}>
      <output className={styles.srOnly()}>กำลังโหลด…</output>
      <Card className={styles.skeletonCard()}>
        <div className={styles.skeletonHead()}>
          <Skeleton className={styles.skeletonTitle()} />
          <Skeleton className={styles.skeletonSubtitle()} />
          <Skeleton className={styles.skeletonAmount()} />
        </div>
        <div className={styles.skeletonRows()}>
          {styles.skeletonWidths.map((width) => (
            <div key={width} className={styles.skeletonRow()}>
              <Skeleton className={styles.skeletonLabel()} />
              <Skeleton className={styles.skeletonValue({ width })} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default function ReceiptPage() {
  const { bookingId = '' } = useParams()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void fetchReceipt(bookingId).then((data) => {
      setReceipt(data)
      setLoaded(true)
    })
  }, [bookingId])

  if (!loaded) return <ReceiptSkeleton />

  const payment = receipt?.payments.find((p) => p.status === 'succeeded') ?? receipt?.payments[0]
  if (!receipt || !payment) {
    return (
      <div className={styles.emptyWrap()}>
        <EmptyState
          icon={ReceiptText}
          title="ไม่พบใบเสร็จนี้"
          description="ตรวจสอบลิงก์อีกครั้ง หรือเข้าสู่ระบบด้วยบัญชีที่ใช้จอง"
        >
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft data-icon="inline-start" aria-hidden />
              กลับหน้าแรก
            </Link>
          </Button>
        </EmptyState>
      </div>
    )
  }

  let status: { text: string; tone: Tone } = {
    text: 'รับเงินแล้วแต่ยังไม่ยืนยันที่นั่ง ติดต่อโรงเรียน',
    tone: 'bad',
  }
  if (payment.status === 'refund_due') {
    status = { text: 'ไม่ได้ที่นั่ง รอคืนเงิน', tone: 'bad' }
  } else if (receipt.status === 'paid') {
    status = { text: 'ชำระแล้ว ยืนยันที่นั่งแล้ว', tone: 'ok' }
  }

  return (
    <article className={styles.article()}>
      {/* On paper: a plain border instead of the ring, and the logo tile and status colours still print. */}
      <Card className={styles.card()}>
        <header className={styles.header()}>
          <Logo />
          <h1 className={styles.heading()}>ใบยืนยันการจองและใบเสร็จรับเงิน</h1>
        </header>

        <div className={styles.amountBox()}>
          <p className={styles.amountLabel()}>ยอดชำระ</p>
          <p className={styles.amount()}>
            {baht(payment.amount)}
          </p>
        </div>

        <dl className={styles.details()}>
          <ReceiptRow label="เลขที่ใบเสร็จ">
            <span className={styles.mono()}>{payment.receipt_no}</span>
          </ReceiptRow>
          <ReceiptRow label="วันที่ชำระ">
            <span className={styles.numeric()}>{dateTime(payment.created_at)}</span>
          </ReceiptRow>
          <ReceiptRow label="ผู้เรียน">{receipt.student_name}</ReceiptRow>
          <ReceiptRow label="คอร์ส">{receipt.courses.title}</ReceiptRow>
          <Separator className={styles.dashedSeparator()} />
          <ReceiptRow label="จำนวนเงิน">
            <span className={styles.numeric()}>{baht(payment.amount)}</span>
          </ReceiptRow>
          <ReceiptRow label="สถานะ">
            <StatusBadge tone={status.tone} className={styles.statusBadge()}>
              {status.text}
            </StatusBadge>
          </ReceiptRow>
        </dl>

        <Separator />
        <p className={styles.note()}>
          การชำระเงินในระบบสาธิตนี้เป็นการจำลอง ไม่มีการตัดเงินจริง
        </p>
      </Card>

      <div className={styles.actions()}>
        <Button asChild variant="ghost">
          <Link to="/">
            <ArrowLeft data-icon="inline-start" aria-hidden />
            กลับหน้าแรก
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer data-icon="inline-start" aria-hidden />
          พิมพ์
        </Button>
      </div>
    </article>
  )
}
