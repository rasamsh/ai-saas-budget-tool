import { cn } from '@/lib/utils'
import { CSSProperties } from 'react'

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-[var(--muted)]', className)} style={style} />
  )
}
