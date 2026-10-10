import { cva } from 'class-variance-authority'

// The icon pops in when the choice changes; nothing animates under reduced motion.
export const triggerIcon = cva(
  'animate-in fade-in-0 zoom-in-75 duration-200 motion-reduce:animate-none',
)
export const itemIcon = cva('size-4 text-muted-foreground')
