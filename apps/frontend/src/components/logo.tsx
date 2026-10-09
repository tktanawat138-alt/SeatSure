import { Armchair } from 'lucide-react'
import { cn } from '@/lib/utils'

/** `inverted` is for placing the logo on the primary colour. */
export function Logo({ className, inverted = false }: Readonly<{ className?: string; inverted?: boolean }>) {
  return (
    <span className={cn('flex items-center gap-2 text-base font-semibold tracking-tight', className)}>
      <span
        className={cn(
          'flex size-7 items-center justify-center rounded-lg',
          inverted ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground',
        )}
      >
        <Armchair className="size-4" aria-hidden />
      </span>
      SeatSure
    </span>
  )
}
