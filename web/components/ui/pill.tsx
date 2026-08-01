import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'accent' | 'outline'
}

const VARIANTS: Record<NonNullable<PillProps['variant']>, string> = {
  accent: 'bg-[var(--accent)] text-[color:var(--accent-foreground)] border-2 border-transparent',
  outline: 'border-2 border-[var(--border)] text-[color:var(--foreground)]',
}

/** Fully-rounded pixel-font badge (Hi-Bit design system). */
export function Pill({ variant = 'accent', className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-pixel text-[10px] uppercase tracking-wider',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
