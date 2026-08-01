import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Small pixel-font uppercase label used above headings (Hi-Bit design system). */
export function Eyebrow({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'font-pixel text-[11px] uppercase tracking-[0.18em] text-[color:var(--accent)]',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
