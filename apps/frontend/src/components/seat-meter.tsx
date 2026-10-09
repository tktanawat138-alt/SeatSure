import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

/** How full a course is: a sentence, the count, and a bar that changes colour as it fills. */
export function SeatMeter({
  taken,
  capacity,
  hideCount = false,
  className,
}: Readonly<{
  taken: number
  capacity: number
  /** For places that already show the count next to the meter. */
  hideCount?: boolean
  className?: string
}>) {
  const left = capacity - taken

  let label = `เหลือ ${left} จาก ${capacity} ที่นั่ง`
  let barColor = '*:data-[slot=progress-indicator]:bg-primary'
  if (left < 0) {
    label = `จองเกิน ${-left} ที่นั่ง (รับ ${capacity} คน)`
    barColor = '*:data-[slot=progress-indicator]:bg-destructive'
  } else if (left === 0) {
    label = `เต็มแล้ว (รับ ${capacity} คน)`
    barColor = '*:data-[slot=progress-indicator]:bg-muted-foreground'
  } else if (taken / capacity >= 0.8) {
    barColor = '*:data-[slot=progress-indicator]:bg-amber-500'
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={cn(left < 0 && 'font-medium text-destructive')}>{label}</span>
        {!hideCount && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {taken}/{capacity}
          </span>
        )}
      </div>
      <Progress
        value={Math.min(100, (taken / capacity) * 100)}
        aria-label={label}
        className={cn('h-1.5', barColor)}
      />
    </div>
  )
}
