import { Progress } from '@/components/ui/progress'
import { bar, count, header, root, status, type BarProps } from './seat-meter.styles'

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
  let level: BarProps['level'] = 'normal'
  if (left < 0) {
    label = `จองเกิน ${-left} ที่นั่ง (รับ ${capacity} คน)`
    level = 'over'
  } else if (left === 0) {
    label = `เต็มแล้ว (รับ ${capacity} คน)`
    level = 'full'
  } else if (taken / capacity >= 0.8) {
    level = 'nearFull'
  }

  return (
    <div className={root({ className })}>
      <div className={header()}>
        <span className={status({ over: left < 0 })}>{label}</span>
        {!hideCount && (
          <span className={count()}>
            {taken}/{capacity}
          </span>
        )}
      </div>
      <Progress
        value={Math.min(100, (taken / capacity) * 100)}
        aria-label={label}
        className={bar({ level })}
      />
    </div>
  )
}
