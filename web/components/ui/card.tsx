import { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a hover lift for clickable cards (month grid, rows). */
  interactive?: boolean
}

/**
 * Shared "sticker" card: warm surface, ink outline, large radius, hard offset shadow.
 * Shadow is inline so a consumer `style` can add to it.
 */
export function Card({ interactive, className, style, children, ...props }: CardProps) {
  const mergedStyle: CSSProperties = { boxShadow: 'var(--card-shadow)', ...style }
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border-2 border-[var(--border)] bg-[var(--card)]',
        interactive &&
          'transition-transform duration-150 hover:-translate-y-0.5 ' +
            'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
      style={mergedStyle}
      {...props}
    >
      {children}
    </div>
  )
}
