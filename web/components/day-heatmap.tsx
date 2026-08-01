import { formatCurrencyExact } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'

interface DayHeatmapProps {
  dailyTotals: number[]
}

export function DayHeatmap({ dailyTotals }: DayHeatmapProps) {
  const max = Math.max(0, ...dailyTotals)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Eyebrow>Daily Spending</Eyebrow>
      </div>

      {max === 0 && (
        <p className="text-sm text-[var(--muted-foreground)] mb-3">
          No expenses recorded this month.
        </p>
      )}

      <div className="grid grid-cols-7 gap-1.5">
        {dailyTotals.map((amount, i) => {
          const intensity = max > 0 ? amount / max : 0
          const title = amount > 0
            ? `Day ${i + 1}: ${formatCurrencyExact(amount)}`
            : `Day ${i + 1}: no spend`

          return (
            <div
              key={i}
              data-testid="heatmap-cell"
              title={title}
              style={{
                '--intensity': String(intensity),
                backgroundColor: 'rgba(239, 68, 68, calc(0.08 + var(--intensity) * 0.82))',
              } as React.CSSProperties}
              className="aspect-square rounded-md flex items-center justify-center text-[10px] font-medium text-[var(--muted-foreground)] tabular-nums"
            >
              {i + 1}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
