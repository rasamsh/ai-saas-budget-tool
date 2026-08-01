import type { Transaction } from './supabase/types'

type MinTxn = Pick<Transaction, 'txn_type' | 'category' | 'merchant' | 'amount' | 'date'>

// ---------------------------------------------------------------------------
// Feature #3: Recurring Subscriptions
// ---------------------------------------------------------------------------

export interface RecurringItem {
  merchant: string
  months: number
  monthlyAvg: number
  annualTotal: number
}

export function computeRecurring(transactions: MinTxn[]): RecurringItem[] {
  const map = new Map<string, { months: Set<number>; total: number }>()

  for (const t of transactions) {
    if (t.txn_type !== 'expense' || t.category !== 'Subscriptions') continue
    const month = parseInt(t.date.slice(5, 7), 10)
    if (!map.has(t.merchant)) map.set(t.merchant, { months: new Set(), total: 0 })
    const entry = map.get(t.merchant)!
    entry.months.add(month)
    entry.total += Number(t.amount)
  }

  return Array.from(map.entries())
    .filter(([, e]) => e.months.size >= 2)
    .map(([merchant, e]) => ({
      merchant,
      months: e.months.size,
      monthlyAvg: e.total / e.months.size,
      annualTotal: e.total,
    }))
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
}

// ---------------------------------------------------------------------------
// Feature #4: Daily sparkline data for month grid
// ---------------------------------------------------------------------------

// Returns Record<month (1-12), number[31]>: index 0 = day 1, index 30 = day 31
export function computeSparklines(transactions: MinTxn[]): Record<number, number[]> {
  const result: Record<number, number[]> = {}

  for (const t of transactions) {
    if (t.txn_type !== 'expense') continue
    const month = parseInt(t.date.slice(5, 7), 10)
    const day   = parseInt(t.date.slice(8, 10), 10)

    if (!result[month]) result[month] = Array(31).fill(0)
    result[month][day - 1] += Number(t.amount)
  }

  return result
}

// ---------------------------------------------------------------------------
// Day-of-Month Spending Heatmap: daily expense totals for a single month
// ---------------------------------------------------------------------------

// Returns number[daysInMonth]: index 0 = day 1, index (daysInMonth - 1) = last day
export function computeDailyExpenseTotals(transactions: MinTxn[], daysInMonth: number): number[] {
  const result = Array(daysInMonth).fill(0)

  for (const t of transactions) {
    if (t.txn_type !== 'expense') continue
    const day = parseInt(t.date.slice(8, 10), 10)
    result[day - 1] += Number(t.amount)
  }

  return result
}

// ---------------------------------------------------------------------------
// Anomaly Alerts: current-month category totals vs. trailing history
// ---------------------------------------------------------------------------

export interface MonthlyCategoryPoint {
  year: number
  month: number
  category: string
  total: number
}

export function computeMonthlyCategoryTotals(transactions: MinTxn[]): MonthlyCategoryPoint[] {
  const map = new Map<string, MonthlyCategoryPoint>()

  for (const t of transactions) {
    if (t.txn_type !== 'expense') continue
    const year  = parseInt(t.date.slice(0, 4), 10)
    const month = parseInt(t.date.slice(5, 7), 10)
    const key = `${year}-${month}-${t.category}`
    if (!map.has(key)) map.set(key, { year, month, category: t.category, total: 0 })
    map.get(key)!.total += Number(t.amount)
  }

  return Array.from(map.values())
}

export interface Anomaly {
  category: string
  current: number
  average: number
  pctAboveAverage: number
}

export function computeAnomalies(
  currentTotals: { category: string; total_amount: number }[],
  historicalPoints: MonthlyCategoryPoint[],
  thresholdPct = 50,
  minHistoryMonths = 2,
): Anomaly[] {
  const historyByCategory = new Map<string, number[]>()
  for (const p of historicalPoints) {
    if (!historyByCategory.has(p.category)) historyByCategory.set(p.category, [])
    historyByCategory.get(p.category)!.push(p.total)
  }

  const anomalies: Anomaly[] = []
  for (const c of currentTotals) {
    const history = historyByCategory.get(c.category) ?? []
    if (history.length < minHistoryMonths) continue

    const average = history.reduce((s, v) => s + v, 0) / history.length
    if (average <= 0) continue

    const pctAboveAverage = ((Number(c.total_amount) - average) / average) * 100
    if (pctAboveAverage >= thresholdPct) {
      anomalies.push({ category: c.category, current: Number(c.total_amount), average, pctAboveAverage })
    }
  }

  return anomalies.sort((a, b) => b.pctAboveAverage - a.pctAboveAverage)
}

// ---------------------------------------------------------------------------
// Category Benchmarks: spend as % of income vs. typical ranges
// ---------------------------------------------------------------------------

// [low, high] as a percentage of monthly income
export const BENCHMARK_RANGES: Record<string, [number, number]> = {
  Groceries:        [8, 12],
  Dining:           [3, 8],
  Shopping:         [3, 8],
  Subscriptions:    [1, 3],
  Transportation:   [10, 15],
  Utilities:        [5, 10],
  Healthcare:       [2, 5],
  Travel:           [2, 5],
  'Car Insurance':  [2, 4],
  Misc:             [1, 5],
}

export interface BenchmarkComparison {
  category: string
  actualPct: number
  range: [number, number]
  status: 'under' | 'within' | 'over'
}

export function computeBenchmarkComparisons(
  categoryTotals: { category: string; total_amount: number }[],
  income: number,
): BenchmarkComparison[] {
  if (income <= 0) return []

  const results: BenchmarkComparison[] = []
  for (const c of categoryTotals) {
    const range = BENCHMARK_RANGES[c.category]
    if (!range) continue

    const actualPct = (Number(c.total_amount) / income) * 100
    const status: BenchmarkComparison['status'] =
      actualPct < range[0] ? 'under' : actualPct > range[1] ? 'over' : 'within'

    results.push({ category: c.category, actualPct, range, status })
  }

  return results
}

// ---------------------------------------------------------------------------
// Recurring vs. One-Time Spend Split
// ---------------------------------------------------------------------------

// A merchant is "recurring" if it appears as an expense in 2+ distinct months
// within the given transaction window (typically current + trailing months).
export function computeRecurringMerchants(transactions: MinTxn[]): Set<string> {
  const monthsByMerchant = new Map<string, Set<string>>()

  for (const t of transactions) {
    if (t.txn_type !== 'expense') continue
    const monthKey = t.date.slice(0, 7) // 'YYYY-MM'
    if (!monthsByMerchant.has(t.merchant)) monthsByMerchant.set(t.merchant, new Set())
    monthsByMerchant.get(t.merchant)!.add(monthKey)
  }

  const recurring = new Set<string>()
  for (const [merchant, months] of monthsByMerchant) {
    if (months.size >= 2) recurring.add(merchant)
  }
  return recurring
}

export function computeRecurringSplit(
  transactions: MinTxn[],
  recurringMerchants: Set<string>,
): { recurring: number; oneTime: number } {
  let recurring = 0
  let oneTime = 0

  for (const t of transactions) {
    if (t.txn_type !== 'expense') continue
    if (recurringMerchants.has(t.merchant)) recurring += Number(t.amount)
    else oneTime += Number(t.amount)
  }

  return { recurring, oneTime }
}

// ---------------------------------------------------------------------------
// Feature #5: Cash flow Sankey diagram layout
// ---------------------------------------------------------------------------

export interface SankeyNode {
  label: string
  amount: number
  color: string
  y: number  // cumulative top position (includes gaps between sinks), normalized [0, 1]
  h: number  // height normalized [0, 1] — slightly less than amount/scale to leave room for gaps
}

export interface SankeyLink {
  label: string
  amount: number
  color: string
  sy: number  // source y start — tightly packed (no gaps), the income bar is undivided
  sh: number  // source height — tightly packed share of the income bar
  ty: number  // target y start (the sink's own, gapped position)
  th: number  // target height (the sink's own, gapped height)
}

export interface SankeyLayout {
  sinks: SankeyNode[]
  links: SankeyLink[]
  hasNegative: boolean
  income: number
  sourceH: number  // income bar height normalized to the same scale as sinks [0, 1]
}

const SANKEY_COLORS = {
  Expenses:  '#ef4444',
  Debt:      '#f59e0b',
  Invested:  '#3b82f6',
  Remaining: '#22c55e',
} as const

// Vertical gap between adjacent sink bars, as a fraction of total diagram height.
// This is also what gives ribbons real curvature: a sink's gapped position on the
// target side no longer lines up with its tightly-packed share of the undivided
// income bar on the source side, so the connecting bezier actually bends instead
// of degenerating into a flat, straight-edged band.
export const SINK_GAP = 0.03

export function buildSankeyLayout(
  income: number,
  expenses: number,
  debt: number,
  invested: number,
): SankeyLayout | null {
  if (income <= 0) return null

  const remaining  = income - expenses - debt - invested
  const hasNegative = remaining < 0

  const rawSinks = [
    { label: 'Expenses',  amount: expenses,             color: SANKEY_COLORS.Expenses },
    { label: 'Debt',      amount: debt,                 color: SANKEY_COLORS.Debt },
    { label: 'Invested',  amount: invested,             color: SANKEY_COLORS.Invested },
    { label: 'Remaining', amount: Math.max(0, remaining), color: hasNegative ? SANKEY_COLORS.Expenses : SANKEY_COLORS.Remaining },
  ]

  const filteredSinks = rawSinks.filter(s => s.amount > 0)
  const totalSinkAmount = filteredSinks.reduce((s, n) => s + n.amount, 0)
  // Normally income is the 100% reference. But when spending exceeds income
  // (hasNegative), sink amounts alone exceed income — scale by whichever is
  // larger so sink heights never sum past 1.0 and overflow the SVG viewBox.
  const scale = Math.max(income, totalSinkAmount)
  const sourceH = income / scale

  const totalGap = SINK_GAP * Math.max(0, filteredSinks.length - 1)
  const availableH = 1 - totalGap

  let cumYTarget = 0
  let cumYSource = 0
  const sinks: SankeyNode[] = []
  const links: SankeyLink[] = []

  filteredSinks.forEach((s, i) => {
    if (i > 0) cumYTarget += SINK_GAP
    const sourceShare = s.amount / scale
    const targetH = sourceShare * availableH

    const sink: SankeyNode = { ...s, y: cumYTarget, h: targetH }
    sinks.push(sink)

    links.push({
      label: s.label,
      amount: s.amount,
      color: s.color,
      sy: cumYSource,
      sh: sourceShare,
      ty: sink.y,
      th: sink.h,
    })

    cumYTarget += targetH
    cumYSource += sourceShare
  })

  return { sinks, links, hasNegative, income, sourceH }
}
