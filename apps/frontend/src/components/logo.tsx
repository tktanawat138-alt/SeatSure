import { Armchair } from 'lucide-react'
import { icon, mark, root } from './logo.styles'

/** `inverted` is for placing the logo on the primary colour. */
export function Logo({ className, inverted = false }: Readonly<{ className?: string; inverted?: boolean }>) {
  return (
    <span className={root({ className })}>
      <span
        className={mark({ inverted })}
      >
        <Armchair className={icon()} aria-hidden />
      </span>
      SeatSure
    </span>
  )
}
