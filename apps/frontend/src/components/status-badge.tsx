import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Tone } from '@/lib/format'
import { badge, dot } from './status-badge.styles'

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
    <Badge variant="outline" className={badge({ tone, className })}>
      <span className={dot()} aria-hidden />
      {children}
    </Badge>
  )
}
