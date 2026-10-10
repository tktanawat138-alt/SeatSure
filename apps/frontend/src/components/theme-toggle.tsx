import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/lib/theme-provider'
import { THEME_CHOICES, type ThemeChoice } from '@/lib/theme'
import { itemIcon, triggerIcon } from './theme-toggle.styles'

const options: Record<ThemeChoice, { label: string; icon: LucideIcon }> = {
  light: { label: 'สว่าง', icon: Sun },
  dark: { label: 'มืด', icon: Moon },
  system: { label: 'ตามระบบ', icon: Monitor },
}

const isChoice = (value: string): value is ThemeChoice => THEME_CHOICES.includes(value as ThemeChoice)

/** Light, dark, or follow the system. Opens with Enter or Space, arrow keys move, Escape closes. */
export function ThemeToggle() {
  const { choice, setChoice } = useTheme()
  const Current = options[choice].icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="เปลี่ยนธีม" title="เปลี่ยนธีม">
          <Current key={choice} className={triggerIcon()} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={choice} onValueChange={(value) => isChoice(value) && setChoice(value)}>
          {THEME_CHOICES.map((value) => {
            const { label, icon: Icon } = options[value]
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon className={itemIcon()} aria-hidden />
                {label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
