import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Eyebrow } from '@/components/ui/eyebrow'
import { KpiCard } from '@/components/kpi-card'
import { MonthGrid } from '@/components/month-grid'
import { AnnualChart } from '@/components/annual-chart'
import { IncomeInput } from '@/components/income-input'
import { CashFlowWaterfall } from '@/components/cash-flow-waterfall'
import { RecurringSubscriptions } from '@/components/recurring-subscriptions'
import { formatCurrency, formatSavingsRate, calcTrend } from '@/lib/utils'
import { computeRecurring, computeSparklines } from '@/lib/finance'
import { MonthlyCategoryTotal } from '@/lib/supabase/types'

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params
  const year = parseInt(yearStr)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: summaries },
    { data: incomeRow },
    { data: categoryTotals },
    { data: priorSummaries },
    { data: priorIncomeRow },
    { data: yearExpenses },
  ] = await Promise.all([
    supabase.from('monthly_summaries').select('*').eq('year', year).eq('user_id', user.id).order('month'),
    supabase.from('user_income').select('annual_income').eq('user_id', user.id).eq('year', year).single(),
    supabase.from('monthly_category_totals').select('*').eq('year', year).eq('txn_type', 'expense').eq('user_id', user.id),
    supabase.from('monthly_summaries').select('*').eq('year', year - 1).eq('user_id', user.id).order('month'),
    supabase.from('user_income').select('annual_income').eq('user_id', user.id).eq('year', year - 1).single(),
    supabase.from('transactions')
      .select('date, amount, merchant, category, txn_type')
      .eq('user_id', user.id)
      .eq('txn_type', 'expense')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`),
  ])

  const annualIncome  = Number(incomeRow?.annual_income ?? 0)
  const monthsCount   = summaries?.length ?? 0
  const ytdExpenses   = summaries?.reduce((s, m) => s + Number(m.expenses),      0) ?? 0
  const ytdInvested   = summaries?.reduce((s, m) => s + Number(m.invested),      0) ?? 0
  const ytdDebt       = summaries?.reduce((s, m) => s + Number(m.debt_payments), 0) ?? 0

  // If the user has set annual income, use it for savings rate; otherwise fall back to tracked income
  const effectiveYtdIncome = annualIncome > 0
    ? (annualIncome / 12) * monthsCount
    : (summaries?.reduce((s, m) => s + Number(m.income), 0) ?? 0)

  const ytdSavingsRate: number | null = effectiveYtdIncome > 0
    ? (effectiveYtdIncome - ytdExpenses - ytdDebt) / effectiveYtdIncome * 100
    : null

  // Prior-year YTD — match only the same months that exist in the current year
  // (avoids comparing 6 months of current year vs 12 months of prior year)
  const currentMonths = new Set(summaries?.map(s => s.month) ?? [])
  const priorFiltered = priorSummaries?.filter(s => currentMonths.has(s.month)) ?? []
  const priorAnnualIncome    = Number(priorIncomeRow?.annual_income ?? 0)
  const priorYtdExpenses     = priorFiltered.reduce((s, m) => s + Number(m.expenses),      0)
  const priorYtdInvested     = priorFiltered.reduce((s, m) => s + Number(m.invested),      0)
  const priorYtdDebt         = priorFiltered.reduce((s, m) => s + Number(m.debt_payments), 0)
  const priorTrackedIncome   = priorFiltered.reduce((s, m) => s + Number(m.income),        0)
  const priorEffectiveIncome = priorAnnualIncome > 0
    ? (priorAnnualIncome / 12) * monthsCount
    : priorTrackedIncome
  const priorYtdSavingsRate: number | null = priorEffectiveIncome > 0
    ? (priorEffectiveIncome - priorYtdExpenses - priorYtdDebt) / priorEffectiveIncome * 100
    : null

  const trendLabel = `vs ${year - 1}`

  // Build per-month top-category map
  const topCategoryByMonth: Record<number, string> = {}
  if (categoryTotals) {
    const byMonth: Record<number, MonthlyCategoryTotal[]> = {}
    categoryTotals.forEach(row => {
      if (!byMonth[row.month]) byMonth[row.month] = []
      byMonth[row.month].push(row)
    })
    Object.entries(byMonth).forEach(([monthStr, rows]) => {
      const month = Number(monthStr)
      const top = rows.reduce((best, r) =>
        Number(r.total_amount) > Number(best.total_amount) ? r : best
      )
      topCategoryByMonth[month] = top.category
    })
  }

  // Feature #3: Recurring subscriptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recurringItems = computeRecurring((yearExpenses ?? []) as any)

  // Feature #4: Daily sparklines for each month card
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sparklines = computeSparklines((yearExpenses ?? []) as any)

  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>Year in review</Eyebrow>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight">{year}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${year - 1}`}
            aria-label="Previous year"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
          >
            ←
          </Link>
          <span className="px-3 py-1.5 rounded-full border-2 border-[var(--border)] bg-[var(--card)] font-semibold text-sm tabular-nums">{year}</span>
          {year < currentYear && (
            <Link
              href={`/${year + 1}`}
              aria-label="Next year"
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
            >
              →
            </Link>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <IncomeInput year={year} initialIncome={annualIncome} />
        <KpiCard
          label="Total Expenses"
          value={formatCurrency(ytdExpenses)}
          subtitle={`YTD · ${monthsCount} month${monthsCount !== 1 ? 's' : ''}`}
          variant="red"
          isNull={ytdExpenses === 0 && monthsCount === 0}
          trend={calcTrend(ytdExpenses, priorYtdExpenses || null, false, trendLabel)}
        />
        <KpiCard
          label="Total Invested"
          value={formatCurrency(ytdInvested)}
          subtitle={`YTD · ${monthsCount} month${monthsCount !== 1 ? 's' : ''}`}
          variant="blue"
          isNull={ytdInvested === 0 && monthsCount === 0}
          trend={calcTrend(ytdInvested, priorYtdInvested || null, true, trendLabel)}
        />
        <KpiCard
          label="Savings Rate"
          value={formatSavingsRate(ytdSavingsRate)}
          subtitle="YTD avg"
          variant={ytdSavingsRate !== null && ytdSavingsRate < 0 ? 'red' : 'green'}
          isNull={ytdSavingsRate === null}
          trend={ytdSavingsRate !== null && priorYtdSavingsRate !== null
            ? calcTrend(ytdSavingsRate, priorYtdSavingsRate, true, trendLabel)
            : null}
        />
      </div>

      {/* Annual chart */}
      <AnnualChart summaries={summaries ?? []} year={year} />

      {/* Feature #5: Cash flow waterfall */}
      {effectiveYtdIncome > 0 && (
        <CashFlowWaterfall
          income={effectiveYtdIncome}
          expenses={ytdExpenses}
          debt={ytdDebt}
          invested={ytdInvested}
        />
      )}

      {/* Feature #3: Recurring subscriptions */}
      <RecurringSubscriptions items={recurringItems} />

      {/* Month grid with sparklines (Feature #4) */}
      <div>
        <h2 className="font-display text-lg font-bold mb-4">Months</h2>
        <MonthGrid
          summaries={summaries ?? []}
          year={year}
          topCategories={topCategoryByMonth}
          sparklines={sparklines}
        />
      </div>
    </div>
  )
}
