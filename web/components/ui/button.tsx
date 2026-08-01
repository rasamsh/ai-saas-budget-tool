import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[var(--accent)] text-[color:var(--accent-foreground)]',
  secondary: 'bg-[var(--card)] text-[color:var(--foreground)]',
}

/**
 * Pressable Hi-Bit button: ink outline + hard offset shadow that compresses on click.
 */
export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--border)]',
        'px-5 py-2.5 text-sm font-bold font-sans',
        'shadow-[0_3px_0_0_var(--foreground)] transition-transform duration-100',
        'hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--foreground)]',
        'disabled:pointer-events-none disabled:opacity-60',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
