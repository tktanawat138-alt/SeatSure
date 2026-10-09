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
import { cn } from '@/lib/utils'

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
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  )
}

function ReceiptSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <output className="sr-only">กำลังโหลด…</output>
      <Card className="gap-8 py-8">
        <div className="flex flex-col items-center gap-4 px-6">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-6 w-64 max-w-full" />
          <Skeleton className="h-11 w-40" />
        </div>
        <div className="space-y-4 px-6">
          {['w-28', 'w-36', 'w-32', 'w-40', 'w-20', 'w-44'].map((width) => (
            <div key={width} className="flex justify-between gap-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className={cn('h-4', width)} />
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
      <div className="mx-auto w-full max-w-lg">
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
    <article className="mx-auto w-full max-w-lg space-y-4">
      {/* On paper: a plain border instead of the ring, and the logo tile and status colours still print. */}
      <Card className="gap-0 py-0 [print-color-adjust:exact] print:break-inside-avoid print:border print:shadow-none print:ring-0">
        <header className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
          <Logo />
          <h1 className="text-lg font-semibold">ใบยืนยันการจองและใบเสร็จรับเงิน</h1>
        </header>

        <div className="mx-6 rounded-lg bg-muted/60 px-4 py-5 text-center print:bg-transparent print:py-2">
          <p className="text-sm text-muted-foreground">ยอดชำระ</p>
          <p className="text-4xl leading-normal font-semibold tracking-tight tabular-nums">
            {baht(payment.amount)}
          </p>
        </div>

        <dl className="space-y-3.5 px-6 py-6 text-sm">
          <ReceiptRow label="เลขที่ใบเสร็จ">
            <span className="font-mono">{payment.receipt_no}</span>
          </ReceiptRow>
          <ReceiptRow label="วันที่ชำระ">
            <span className="tabular-nums">{dateTime(payment.created_at)}</span>
          </ReceiptRow>
          <ReceiptRow label="ผู้เรียน">{receipt.student_name}</ReceiptRow>
          <ReceiptRow label="คอร์ส">{receipt.courses.title}</ReceiptRow>
          <Separator className="border-t border-dashed bg-transparent" />
          <ReceiptRow label="จำนวนเงิน">
            <span className="tabular-nums">{baht(payment.amount)}</span>
          </ReceiptRow>
          <ReceiptRow label="สถานะ">
            <StatusBadge tone={status.tone} className="h-auto max-w-full shrink py-0.5 text-left whitespace-normal">
              {status.text}
            </StatusBadge>
          </ReceiptRow>
        </dl>

        <Separator />
        <p className="px-6 py-4 text-center text-xs text-muted-foreground">
          การชำระเงินในระบบสาธิตนี้เป็นการจำลอง ไม่มีการตัดเงินจริง
        </p>
      </Card>

      <div className="flex items-center justify-between gap-2 print:hidden">
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
