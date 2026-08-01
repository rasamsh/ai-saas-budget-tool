import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Hi-Bit text input: soft border at rest, ink border + accent ring on focus. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-xl border-2 border-[var(--border-soft)] bg-[var(--card)]',
          'px-3.5 py-2.5 text-sm text-[color:var(--foreground)]',
          'outline-none transition-colors',
          'focus:border-[var(--border)] focus:ring-4 focus:ring-[color:var(--accent-soft)]',
          'placeholder:text-[color:var(--muted-foreground)]',
          className,
        )}
        {...props}
      />
    )
  },
)
