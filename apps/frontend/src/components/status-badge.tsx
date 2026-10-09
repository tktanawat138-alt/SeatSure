import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Tone } from '@/lib/format'
import { cn } from '@/lib/utils'

const toneClasses: Record<Tone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  bad: 'border-red-200 bg-red-50 text-red-700',
  muted: 'border-transparent bg-muted text-muted-foreground',
}

/** A coloured status label. Tones match the ones returned by bookingStatus() in lib/format. */
export function StatusBadge({
  tone,
  children,
  className,
}: Readonly<{
  tone: Tone
  children: ReactNode
  className?: string
}>) {
  return (
    <Badge variant="outline" className={cn(toneClasses[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </Badge>
  )
}
