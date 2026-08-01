import { cn, Trend } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'

interface KpiCardProps {
  label: string
  value: string
  subtitle?: string
  variant?: 'default' | 'green' | 'red' | 'blue' | 'amber' | 'muted'
  isNull?: boolean
  trend?: Trend | null
}

const variantValueClass: Record<string, string> = {
  default: 'text-[var(--foreground)]',
  green:   'text-green-500',
  red:     'text-red-500',
  blue:    'text-blue-500',
  amber:   'text-amber-500',
  muted:   'text-[var(--muted-foreground)]',
}

function TrendBadge({ trend }: { trend: Trend }) {
  const { pct, direction, isPositive, label } = trend

  const isGood =
    (direction === 'up'   &&  isPositive) ||
    (direction === 'down' && !isPositive)

  const colorClass =
    direction === 'flat'
      ? 'text-[var(--muted-foreground)]'
      : isGood
        ? 'text-green-500'
        : 'text-red-500'

  const arrow =
    direction === 'up'   ? '↑' :
    direction === 'down' ? '↓' : '→'

  const pctStr = direction === 'flat' ? '~0%' : `${pct.toFixed(1)}%`

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
        colorClass,
        direction === 'flat' ? 'border-[var(--border-soft)]' : 'border-current/40',
      )}
    >
      {arrow} {pctStr} {label}
    </span>
  )
}

export function KpiCard({ label, value, subtitle, variant = 'default', isNull = false, trend }: KpiCardProps) {
  return (
    <Card
      className={cn(
        'p-5 flex flex-col gap-1 transition-all duration-150',
        isNull && 'opacity-60',
      )}
    >
      <Eyebrow>{label}</Eyebrow>
      <span
        className={cn(
          'font-display text-3xl font-extrabold leading-none',
          isNull ? 'text-[var(--muted-foreground)]' : variantValueClass[variant],
        )}
      >
        {isNull ? '—' : value}
      </span>
      {subtitle && (
        <span className="text-xs text-[var(--muted-foreground)] mt-0.5">{subtitle}</span>
      )}
      {trend && !isNull && <TrendBadge trend={trend} />}
    </Card>
  )
}
