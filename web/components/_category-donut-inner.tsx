'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { computeBenchmarkComparisons } from '@/lib/finance'
import { CategorySlice } from './category-donut'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'
import { Mascot } from '@/components/ui/mascot'

const FALLBACK_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
]

interface TooltipPayloadEntry {
  name: string
  value: number
  payload: CategorySlice & { pct: number }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div
      className="rounded-[var(--radius-card)] border-2 border-[var(--border)] bg-[var(--card)] p-3 text-sm"
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <p className="font-semibold">{d.name}</p>
      <p className="text-[var(--muted-foreground)]">{formatCurrency(d.value)} · {d.payload.pct.toFixed(1)}%</p>
    </div>
  )
}

interface CategoryDonutInnerProps {
  categoryTotals: CategorySlice[]
  income?: number
}

export default function CategoryDonutInner({ categoryTotals, income = 0 }: CategoryDonutInnerProps) {
  if (!categoryTotals.length) {
    return (
      <Card className="p-8 text-center flex flex-col items-center justify-center gap-3 min-h-[280px]">
        <Mascot size={56} />
        <p className="text-[var(--muted-foreground)] text-sm">No expense categories for this month.</p>
      </Card>
    )
  }

  const total = categoryTotals.reduce((s, c) => s + Number(c.total_amount), 0)
  const data = categoryTotals.map((c, i) => ({
    ...c,
    total_amount: Number(c.total_amount),
    pct: total > 0 ? (Number(c.total_amount) / total) * 100 : 0,
    fill: c.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }))

  const benchmarksByCategory = Object.fromEntries(
    computeBenchmarkComparisons(categoryTotals, income).map(b => [b.category, b]),
  )

  return (
    <Card className="p-5">
      <Eyebrow className="block mb-4">Expenses by Category</Eyebrow>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total_amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {data.map((entry, i) => {
          const benchmark = benchmarksByCategory[entry.category]
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: entry.fill }}
                  />
                  <span className="truncate text-[var(--foreground)]">{entry.category}</span>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-[var(--muted-foreground)]">{entry.pct.toFixed(1)}%</span>
                  <span className="font-medium">{formatCurrency(entry.total_amount)}</span>
                </div>
              </div>
              {benchmark && (
                <p className="pl-4.5 text-xs text-[var(--muted-foreground)]">
                  {benchmark.actualPct.toFixed(1)}% of income · typical {benchmark.range[0]}–{benchmark.range[1]}%
                  {benchmark.status === 'over' && (
                    <span className="text-amber-500 font-medium"> · above typical</span>
                  )}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
