import { MonthlySummary } from '@/lib/supabase/types'
import { monthName, formatCurrency } from '@/lib/utils'
import { Sparkline } from '@/components/sparkline'
import { Pill } from '@/components/ui/pill'
import Link from 'next/link'

interface MonthGridProps {
  summaries: MonthlySummary[]
  year: number
  topCategories: Record<number, string>
  sparklines?: Record<number, number[]>
}

export function MonthGrid({ summaries, year, topCategories, sparklines = {} }: MonthGridProps) {
  const summaryByMonth = Object.fromEntries(summaries.map(s => [s.month, s]))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
        const summary = summaryByMonth[month]
        const monthStr = month.toString().padStart(2, '0')
        const topCat = topCategories[month]

        if (!summary) {
          return (
            <div
              key={month}
              className="rounded-[var(--radius-card)] border-2 border-[var(--border-soft)] p-4 opacity-60 cursor-not-allowed bg-[var(--card)]"
            >
              <div className="font-display font-bold text-[var(--muted-foreground)]">{monthName(month)}</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">No data</div>
            </div>
          )
        }

        const sparklineValues = sparklines[month]

        return (
          <Link
            key={month}
            href={`/${year}/${monthStr}`}
            style={{ boxShadow: 'var(--card-shadow)' }}
            className="block rounded-[var(--radius-card)] border-2 border-[var(--border)] bg-[var(--card)] p-4 transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div className="font-display font-bold text-[var(--foreground)]">{monthName(month)}</div>
            <div className="font-display text-xl font-extrabold text-red-500 mt-1">{formatCurrency(Number(summary.expenses))}</div>
            {topCat ? (
              <div className="mt-1.5 overflow-hidden">
                <Pill variant="outline">{topCat}</Pill>
              </div>
            ) : (
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5">expenses</div>
            )}
            {sparklineValues && (
              <div className="mt-2">
                <Sparkline values={sparklineValues} width={80} height={20} color="#ef4444" />
              </div>
            )}
            {summary.savings_rate_pct !== null && (
              <div className={`text-xs font-semibold mt-1.5 ${Number(summary.savings_rate_pct) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {Number(summary.savings_rate_pct).toFixed(1)}% saved
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
