'use client'
import { useRouter } from 'next/navigation'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { MonthlySummary } from '@/lib/supabase/types'
import { shortMonthName, formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'
import { Mascot } from '@/components/ui/mascot'

interface Props {
  summaries: MonthlySummary[]
  year: number
}

interface ChartDataPoint {
  month: number
  name: string
  income: number
  expenses: number
  invested: number
  debt: number
}

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-[var(--radius-card)] border-2 border-[var(--border)] bg-[var(--card)] p-3 text-sm"
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-6 mb-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            <span className="text-[var(--muted-foreground)]">{entry.name}</span>
          </span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnnualChartInner({ summaries, year }: Props) {
  const router = useRouter()

  const summaryMap = Object.fromEntries(summaries.map(s => [s.month, s]))

  const data: ChartDataPoint[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const s = summaryMap[month]
    return {
      month,
      name: shortMonthName(month),
      income:   s ? Number(s.income)       : 0,
      expenses: s ? Number(s.expenses)     : 0,
      invested: s ? Number(s.invested)     : 0,
      debt:     s ? Number(s.debt_payments): 0,
    }
  })

  const hasData = data.some(d => d.income > 0 || d.expenses > 0)

  if (!hasData) {
    return (
      <Card className="p-8 text-center flex flex-col items-center gap-3">
        <Mascot size={56} />
        <p className="text-[var(--muted-foreground)]">No data for {year}. Run the CLI pipeline to import data.</p>
      </Card>
    )
  }

  function handleBarClick(data: ChartDataPoint) {
    if (!data?.month) return
    router.push(`/${year}/${data.month.toString().padStart(2, '0')}`)
  }

  return (
    <Card className="p-5">
      <Eyebrow className="block mb-4">Monthly Overview</Eyebrow>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12, color: 'var(--muted-foreground)' }}
          />
          <Bar
            dataKey="expenses"
            name="Expenses"
            stackId="spend"
            fill="#ef4444"
            radius={[0, 0, 0, 0]}
            cursor="pointer"
            onClick={handleBarClick}
            isAnimationActive={false}
          />
          <Bar
            dataKey="debt"
            name="Debt"
            stackId="spend"
            fill="#f59e0b"
            cursor="pointer"
            onClick={handleBarClick}
            isAnimationActive={false}
          />
          <Bar
            dataKey="invested"
            name="Invested"
            stackId="spend"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={handleBarClick}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  )
}
