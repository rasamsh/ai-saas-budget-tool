import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { KpiCard } from '@/components/kpi-card'
import { CategoryDonut, CategorySlice } from '@/components/category-donut'
import { TopMerchants, MerchantRow } from '@/components/top-merchants'
import { TransactionTable } from '@/components/transaction-table'
import { Card } from '@/components/ui/card'
import { Mascot } from '@/components/ui/mascot'
import { formatCurrency, formatSavingsRate, monthName, shortMonthName, calcTrend } from '@/lib/utils'
import { Transaction } from '@/lib/supabase/types'
import { CashFlowWaterfall } from '@/components/cash-flow-waterfall'
import { DayHeatmap } from '@/components/day-heatmap'
import { AnomalyBanner } from '@/components/anomaly-banner'
import {
  computeDailyExpenseTotals,
  computeMonthlyCategoryTotals,
  computeAnomalies,
  computeRecurringMerchants,
  computeRecurringSplit,
} from '@/lib/finance'

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function MonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>
}) {
  const { year: yearStr, month: monthStr } = await params
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const paddedMonth = month.toString().padStart(2, '0')
  // new Date(year, month, 0) uses JS 0-indexed months: day 0 of month N = last day of month N-1 (1-indexed)
  const lastDay = new Date(year, month, 0).getDate().toString().padStart(2, '0')

  // Trailing 6 full months before the current one — feeds anomaly detection and recurring-merchant detection
  const historyEnd   = new Date(year, month - 1, 0)
  const historyStart = new Date(year, month - 1 - 6, 1)

  const [
    { data: summary },
    { data: rawCategoryTotals },
    { data: rawTransactions },
    { data: allCategories },
    { data: incomeRow },
    { data: priorSummary },
    { data: priorIncomeRow },
    { data: rawHistoricalTransactions },
  ] = await Promise.all([
    supabase.from('monthly_summaries').select('*').eq('year', year).eq('month', month).eq('user_id', user.id).single(),
    supabase.from('monthly_category_totals').select('*').eq('year', year).eq('month', month).eq('txn_type', 'expense').eq('user_id', user.id).order('total_amount', { ascending: false }),
    supabase.from('transactions').select('*, accounts(id, name, bank, user_id, created_at), categories(name, txn_type, color)').eq('user_id', user.id).gte('date', `${year}-${paddedMonth}-01`).lte('date', `${year}-${paddedMonth}-${lastDay}`).order('date', { ascending: false }),
    supabase.from('categories').select('*'),
    supabase.from('user_income').select('annual_income').eq('user_id', user.id).eq('year', year).single(),
    supabase.from('monthly_summaries').select('*').eq('year', year - 1).eq('month', month).eq('user_id', user.id).single(),
    supabase.from('user_income').select('annual_income').eq('user_id', user.id).eq('year', year - 1).single(),
    supabase.from('transactions').select('date, merchant, category, amount, txn_type').eq('user_id', user.id).eq('txn_type', 'expense').gte('date', toISODate(historyStart)).lte('date', toISODate(historyEnd)),
  ])

  // Monthly income: prefer manual annual income / 12; fall back to tracked income transactions
  const annualIncome   = Number(incomeRow?.annual_income ?? 0)
  const trackedIncome  = Number(summary?.income ?? 0)
  const monthlyIncome  = annualIncome > 0 ? annualIncome / 12 : trackedIncome
  const expenses       = Number(summary?.expenses ?? 0)
  const debtPayments   = Number(summary?.debt_payments ?? 0)
  const savingsRate: number | null = monthlyIncome > 0
    ? (monthlyIncome - expenses - debtPayments) / monthlyIncome * 100
    : null

  // Prior year same-month values for trend arrows
  const priorAnnualIncome  = Number(priorIncomeRow?.annual_income ?? 0)
  const priorTrackedIncome = Number(priorSummary?.income ?? 0)
  const priorMonthlyIncome = priorAnnualIncome > 0 ? priorAnnualIncome / 12 : priorTrackedIncome
  const priorExpenses      = Number(priorSummary?.expenses ?? 0)
  const priorInvested      = Number(priorSummary?.invested ?? 0)
  const priorDebt          = Number(priorSummary?.debt_payments ?? 0)
  const priorSavingsRate: number | null = priorMonthlyIncome > 0
    ? (priorMonthlyIncome - priorExpenses - priorDebt) / priorMonthlyIncome * 100
    : null


  const trendLabel = `vs ${shortMonthName(month)} '${String(year - 1).slice(2)}`

  const transactions: Transaction[] = (rawTransactions ?? []) as Transaction[]
  const categories = allCategories ?? []

  // Build category totals with colors from categories table
  const catColorMap = Object.fromEntries(categories.map(c => [c.name, c.color]))
  const categoryTotals: CategorySlice[] = (rawCategoryTotals ?? []).map(row => ({
    category: row.category,
    total_amount: Number(row.total_amount),
    color: catColorMap[row.category] ?? '#6b7280',
  }))

  // Compute top 5 merchants (expenses only) server-side
  const merchantMap: Record<string, { total: number; count: number }> = {}
  transactions
    .filter(t => t.txn_type === 'expense')
    .forEach(t => {
      if (!merchantMap[t.merchant]) merchantMap[t.merchant] = { total: 0, count: 0 }
      merchantMap[t.merchant].total += Number(t.amount)
      merchantMap[t.merchant].count += 1
    })
  const topMerchants: MerchantRow[] = Object.entries(merchantMap)
    .map(([merchant, { total, count }]) => ({ merchant, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const dailyExpenseTotals = computeDailyExpenseTotals(transactions, Number(lastDay))

  // Anomaly detection: compare this month's category totals against trailing history
  const historicalTransactions: Transaction[] = (rawHistoricalTransactions ?? []) as Transaction[]
  const historicalCategoryPoints = computeMonthlyCategoryTotals(historicalTransactions)
  const anomalies = computeAnomalies(categoryTotals, historicalCategoryPoints)

  // Recurring vs. one-time split for this month's expenses
  const recurringMerchants = computeRecurringMerchants([...historicalTransactions, ...transactions])
  const recurringSplit = computeRecurringSplit(transactions, recurringMerchants)

  // Breadcrumb / navigation helpers
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear  = month === 12 ? year + 1 : year

  const prevHref = `/${prevYear}/${prevMonth.toString().padStart(2, '0')}`
  const nextHref = `/${nextYear}/${nextMonth.toString().padStart(2, '0')}`

  const hasData = !!summary || transactions.length > 0

  return (
    <div className="space-y-8">
      {/* Breadcrumb + navigation */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] mb-0.5">
            <Link href={`/${year}`} className="hover:text-[var(--foreground)] transition-colors">
              {year}
            </Link>
            <span>/</span>
            <span className="text-[var(--foreground)]">{monthName(month)}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight">
            {monthName(month)}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            aria-label="Previous month"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
          >
            ←
          </Link>
          <span className="px-3 py-1.5 rounded-full border-2 border-[var(--border)] bg-[var(--card)] font-semibold text-sm tabular-nums">
            {monthName(month)} {year}
          </span>
          <Link
            href={nextHref}
            aria-label="Next month"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
          >
            →
          </Link>
        </div>
      </div>

      {!hasData ? (
        <Card className="p-12 text-center flex flex-col items-center gap-3">
          <Mascot size={64} />
          <div>
            <h2 className="font-display text-xl font-bold">Nothing here yet</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              No transactions imported for {monthName(month)} {year}. Run the pipeline to import your statements.
            </p>
          </div>
          <Link
            href="/settings/imports"
            className="text-sm font-semibold text-[color:var(--accent)] hover:underline"
          >
            View import log →
          </Link>
        </Card>
      ) : (
        <>
          <AnomalyBanner anomalies={anomalies} />

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              label="Income"
              value={formatCurrency(monthlyIncome)}
              subtitle={annualIncome > 0 ? `${formatCurrency(annualIncome)} / yr` : undefined}
              variant="green"
              isNull={monthlyIncome === 0}
              trend={calcTrend(monthlyIncome, priorMonthlyIncome || null, true, trendLabel)}
            />
            <KpiCard
              label="Expenses"
              value={formatCurrency(expenses)}
              subtitle={expenses > 0
                ? `${formatCurrency(recurringSplit.recurring)} recurring · ${formatCurrency(recurringSplit.oneTime)} one-time`
                : undefined}
              variant="red"
              isNull={!summary || expenses === 0}
              trend={calcTrend(expenses, priorExpenses || null, false, trendLabel)}
            />
            <KpiCard
              label="Invested"
              value={formatCurrency(Number(summary?.invested ?? 0))}
              variant="blue"
              isNull={!summary || Number(summary.invested) === 0}
              trend={calcTrend(Number(summary?.invested ?? 0), priorInvested || null, true, trendLabel)}
            />
            <KpiCard
              label="Debt Payments"
              value={formatCurrency(Number(summary?.debt_payments ?? 0))}
              variant="amber"
              isNull={!summary || Number(summary.debt_payments) === 0}
              trend={calcTrend(Number(summary?.debt_payments ?? 0), priorDebt || null, false, trendLabel)}
            />
            <KpiCard
              label="Savings Rate"
              value={formatSavingsRate(savingsRate)}
              variant={savingsRate !== null ? (savingsRate < 0 ? 'red' : 'green') : 'muted'}
              isNull={savingsRate === null}
              trend={savingsRate !== null && priorSavingsRate !== null
                ? calcTrend(savingsRate, priorSavingsRate, true, trendLabel)
                : null}
            />
          </div>

          {/* Feature #5: Cash flow waterfall */}
          {monthlyIncome > 0 && (
            <CashFlowWaterfall
              income={monthlyIncome}
              expenses={expenses}
              debt={debtPayments}
              invested={Number(summary?.invested ?? 0)}
            />
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryDonut categoryTotals={categoryTotals} income={monthlyIncome} />
            <TopMerchants merchants={topMerchants} />
          </div>

          <DayHeatmap dailyTotals={dailyExpenseTotals} />

          {/* Transaction table */}
          <div>
            <h2 className="font-display text-lg font-bold mb-4">Transactions</h2>
            <TransactionTable
              transactions={transactions}
              categories={categories}
            />
          </div>
        </>
      )}
    </div>
  )
}
