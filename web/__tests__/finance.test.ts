import { describe, it, expect } from 'vitest'
import {
  computeRecurring,
  computeSparklines,
  buildSankeyLayout,
  SINK_GAP,
  computeDailyExpenseTotals,
  computeMonthlyCategoryTotals,
  computeAnomalies,
  BENCHMARK_RANGES,
  computeBenchmarkComparisons,
  computeRecurringMerchants,
  computeRecurringSplit,
} from '@/lib/finance'
import type { Transaction } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-06-15',
    merchant: 'Netflix',
    amount: 15.99,
    category: 'Subscriptions',
    txn_type: 'expense',
    account_id: 'acc-1',
    import_batch_id: null,
    hash: '',
    user_id: 'user-1',
    created_at: '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeRecurring
// ---------------------------------------------------------------------------

describe('computeRecurring', () => {
  it('returns empty array for no transactions', () => {
    expect(computeRecurring([])).toEqual([])
  })

  it('excludes merchants that appear in only one month', () => {
    const txns = [makeTxn({ merchant: 'Netflix', date: '2026-01-15' })]
    expect(computeRecurring(txns)).toEqual([])
  })

  it('includes merchants appearing in 2 or more months', () => {
    const txns = [
      makeTxn({ merchant: 'Netflix', date: '2026-01-15', amount: 15.99 }),
      makeTxn({ merchant: 'Netflix', date: '2026-02-15', amount: 15.99 }),
    ]
    const result = computeRecurring(txns)
    expect(result).toHaveLength(1)
    expect(result[0].merchant).toBe('Netflix')
  })

  it('counts unique months correctly (two charges same month = 1 month)', () => {
    const txns = [
      makeTxn({ merchant: 'Spotify', date: '2026-01-01', amount: 9.99 }),
      makeTxn({ merchant: 'Spotify', date: '2026-01-15', amount: 9.99 }), // same month
      makeTxn({ merchant: 'Spotify', date: '2026-02-01', amount: 9.99 }),
    ]
    const result = computeRecurring(txns)
    expect(result[0].months).toBe(2) // Jan and Feb, not 3
  })

  it('computes annualTotal as sum of all charges', () => {
    const txns = [
      makeTxn({ merchant: 'Hulu', date: '2026-01-15', amount: 17.99 }),
      makeTxn({ merchant: 'Hulu', date: '2026-02-15', amount: 17.99 }),
      makeTxn({ merchant: 'Hulu', date: '2026-03-15', amount: 17.99 }),
    ]
    const result = computeRecurring(txns)
    expect(result[0].annualTotal).toBeCloseTo(53.97, 2)
  })

  it('computes monthlyAvg as annualTotal / unique months', () => {
    const txns = [
      makeTxn({ merchant: 'Disney+', date: '2026-01-15', amount: 10.99 }),
      makeTxn({ merchant: 'Disney+', date: '2026-02-15', amount: 10.99 }),
    ]
    const result = computeRecurring(txns)
    expect(result[0].monthlyAvg).toBeCloseTo(10.99, 2)
  })

  it('sorts results by monthlyAvg descending (most expensive first)', () => {
    const txns = [
      makeTxn({ merchant: 'Spotify', date: '2026-01-01', amount: 9.99 }),
      makeTxn({ merchant: 'Spotify', date: '2026-02-01', amount: 9.99 }),
      makeTxn({ merchant: 'Netflix', date: '2026-01-01', amount: 22.99 }),
      makeTxn({ merchant: 'Netflix', date: '2026-02-01', amount: 22.99 }),
    ]
    const result = computeRecurring(txns)
    expect(result[0].merchant).toBe('Netflix')
    expect(result[1].merchant).toBe('Spotify')
  })

  it('excludes non-Subscription category transactions', () => {
    const txns = [
      makeTxn({ merchant: 'Amazon', category: 'Shopping', date: '2026-01-01' }),
      makeTxn({ merchant: 'Amazon', category: 'Shopping', date: '2026-02-01' }),
    ]
    expect(computeRecurring(txns)).toEqual([])
  })

  it('excludes income and investment txn_types even if category is Subscriptions', () => {
    const txns = [
      makeTxn({ merchant: 'Odd', category: 'Subscriptions', txn_type: 'income', date: '2026-01-01' }),
      makeTxn({ merchant: 'Odd', category: 'Subscriptions', txn_type: 'income', date: '2026-02-01' }),
    ]
    expect(computeRecurring(txns)).toEqual([])
  })

  it('handles multiple merchants correctly', () => {
    const txns = [
      makeTxn({ merchant: 'Netflix', date: '2026-01-01', amount: 15.99 }),
      makeTxn({ merchant: 'Netflix', date: '2026-02-01', amount: 15.99 }),
      makeTxn({ merchant: 'Spotify', date: '2026-01-01', amount: 9.99 }),
      // Spotify only once — excluded
    ]
    const result = computeRecurring(txns)
    expect(result).toHaveLength(1)
    expect(result[0].merchant).toBe('Netflix')
  })

  it('handles 12 months of subscription correctly', () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      makeTxn({
        merchant: 'YouTube Premium',
        date: `2026-${String(i + 1).padStart(2, '0')}-01`,
        amount: 13.99,
      })
    )
    const result = computeRecurring(months)
    expect(result[0].months).toBe(12)
    expect(result[0].annualTotal).toBeCloseTo(167.88, 1)
    expect(result[0].monthlyAvg).toBeCloseTo(13.99, 2)
  })
})

// ---------------------------------------------------------------------------
// computeSparklines
// ---------------------------------------------------------------------------

describe('computeSparklines', () => {
  it('returns empty object for no transactions', () => {
    expect(computeSparklines([])).toEqual({})
  })

  it('only includes expense transactions', () => {
    const txns = [
      makeTxn({ txn_type: 'income', category: 'Income', date: '2026-06-01', amount: 5000 }),
      makeTxn({ txn_type: 'investment', category: 'Taxable Brokerage', date: '2026-06-01', amount: 1000 }),
    ]
    expect(computeSparklines(txns)).toEqual({})
  })

  it('places amount in the correct month bucket', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-06-15', amount: 50 })]
    const result = computeSparklines(txns)
    expect(result[6]).toBeDefined()
    expect(result[1]).toBeUndefined()
  })

  it('places amount at the correct day index (day 1 → index 0)', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-06-01', amount: 100 })]
    const result = computeSparklines(txns)
    expect(result[6][0]).toBe(100) // day 1 → index 0
  })

  it('places amount at day 15 → index 14', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-06-15', amount: 75 })]
    const result = computeSparklines(txns)
    expect(result[6][14]).toBe(75)
  })

  it('places amount at day 31 → index 30', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-01-31', amount: 200 })]
    const result = computeSparklines(txns)
    expect(result[1][30]).toBe(200)
  })

  it('sums multiple transactions on the same day', () => {
    const txns = [
      makeTxn({ txn_type: 'expense', date: '2026-06-10', amount: 30 }),
      makeTxn({ txn_type: 'expense', date: '2026-06-10', amount: 20 }),
    ]
    const result = computeSparklines(txns)
    expect(result[6][9]).toBe(50) // day 10 → index 9
  })

  it('returns a 31-element array per month', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-06-15', amount: 50 })]
    const result = computeSparklines(txns)
    expect(result[6]).toHaveLength(31)
  })

  it('fills days with no spend as 0', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-06-01', amount: 100 })]
    const result = computeSparklines(txns)
    expect(result[6][1]).toBe(0) // day 2 has no spend
  })

  it('correctly separates data into multiple months', () => {
    const txns = [
      makeTxn({ txn_type: 'expense', date: '2026-01-15', amount: 50 }),
      makeTxn({ txn_type: 'expense', date: '2026-06-15', amount: 100 }),
    ]
    const result = computeSparklines(txns)
    expect(result[1][14]).toBe(50)
    expect(result[6][14]).toBe(100)
    expect(result[1]).toHaveLength(31)
    expect(result[6]).toHaveLength(31)
  })
})

// ---------------------------------------------------------------------------
// computeDailyExpenseTotals
// ---------------------------------------------------------------------------

describe('computeDailyExpenseTotals', () => {
  it('returns an array of length daysInMonth, all zero, for no transactions', () => {
    expect(computeDailyExpenseTotals([], 30)).toEqual(Array(30).fill(0))
  })

  it('respects daysInMonth for a 28-day February', () => {
    expect(computeDailyExpenseTotals([], 28)).toHaveLength(28)
  })

  it('places amount at the correct day index (day 1 → index 0)', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-06-01', amount: 42 })]
    expect(computeDailyExpenseTotals(txns, 30)[0]).toBe(42)
  })

  it('places amount at day 15 → index 14', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-06-15', amount: 75 })]
    expect(computeDailyExpenseTotals(txns, 30)[14]).toBe(75)
  })

  it('sums multiple transactions on the same day', () => {
    const txns = [
      makeTxn({ txn_type: 'expense', date: '2026-06-10', amount: 30 }),
      makeTxn({ txn_type: 'expense', date: '2026-06-10', amount: 20 }),
    ]
    expect(computeDailyExpenseTotals(txns, 30)[9]).toBe(50)
  })

  it('ignores non-expense transaction types', () => {
    const txns = [
      makeTxn({ txn_type: 'income', category: 'Income', date: '2026-06-01', amount: 5000 }),
      makeTxn({ txn_type: 'investment', category: 'Taxable Brokerage', date: '2026-06-01', amount: 1000 }),
      makeTxn({ txn_type: 'debt', category: 'Car Loan', date: '2026-06-01', amount: 600 }),
    ]
    expect(computeDailyExpenseTotals(txns, 30)).toEqual(Array(30).fill(0))
  })

  it('fills days with no spend as 0', () => {
    const txns = [makeTxn({ txn_type: 'expense', date: '2026-06-01', amount: 100 })]
    const result = computeDailyExpenseTotals(txns, 30)
    expect(result[1]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeMonthlyCategoryTotals
// ---------------------------------------------------------------------------

describe('computeMonthlyCategoryTotals', () => {
  it('returns an empty array for no transactions', () => {
    expect(computeMonthlyCategoryTotals([])).toEqual([])
  })

  it('groups by year, month, and category', () => {
    const txns = [
      makeTxn({ txn_type: 'expense', category: 'Dining', date: '2026-01-10', amount: 50 }),
      makeTxn({ txn_type: 'expense', category: 'Dining', date: '2026-01-20', amount: 30 }),
    ]
    const result = computeMonthlyCategoryTotals(txns)
    expect(result).toEqual([{ year: 2026, month: 1, category: 'Dining', total: 80 }])
  })

  it('keeps different months separate', () => {
    const txns = [
      makeTxn({ txn_type: 'expense', category: 'Dining', date: '2026-01-10', amount: 50 }),
      makeTxn({ txn_type: 'expense', category: 'Dining', date: '2026-02-10', amount: 60 }),
    ]
    const result = computeMonthlyCategoryTotals(txns)
    expect(result).toHaveLength(2)
  })

  it('ignores non-expense transactions', () => {
    const txns = [makeTxn({ txn_type: 'income', category: 'Income', date: '2026-01-10', amount: 5000 })]
    expect(computeMonthlyCategoryTotals(txns)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// computeAnomalies
// ---------------------------------------------------------------------------

describe('computeAnomalies', () => {
  it('returns empty array when there are no current totals', () => {
    expect(computeAnomalies([], [])).toEqual([])
  })

  it('flags a category that exceeds the threshold above its historical average', () => {
    const current = [{ category: 'Dining', total_amount: 340 }]
    const history = [
      { year: 2026, month: 4, category: 'Dining', total: 200 },
      { year: 2026, month: 5, category: 'Dining', total: 200 },
    ]
    const result = computeAnomalies(current, history)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('Dining')
    expect(result[0].average).toBe(200)
    expect(result[0].pctAboveAverage).toBeCloseTo(70, 1)
  })

  it('does not flag a category within threshold of its average', () => {
    const current = [{ category: 'Dining', total_amount: 220 }]
    const history = [
      { year: 2026, month: 4, category: 'Dining', total: 200 },
      { year: 2026, month: 5, category: 'Dining', total: 200 },
    ]
    expect(computeAnomalies(current, history)).toEqual([])
  })

  it('skips categories with fewer than the minimum history months', () => {
    const current = [{ category: 'Travel', total_amount: 1000 }]
    const history = [{ year: 2026, month: 5, category: 'Travel', total: 100 }]
    expect(computeAnomalies(current, history)).toEqual([])
  })

  it('skips categories with no history at all', () => {
    const current = [{ category: 'NewCategory', total_amount: 500 }]
    expect(computeAnomalies(current, [])).toEqual([])
  })

  it('respects a custom threshold', () => {
    const current = [{ category: 'Dining', total_amount: 250 }]
    const history = [
      { year: 2026, month: 4, category: 'Dining', total: 200 },
      { year: 2026, month: 5, category: 'Dining', total: 200 },
    ]
    // 25% above average — not flagged at default 50% threshold, flagged at 20%
    expect(computeAnomalies(current, history, 50)).toEqual([])
    expect(computeAnomalies(current, history, 20)).toHaveLength(1)
  })

  it('sorts results by pctAboveAverage descending', () => {
    const current = [
      { category: 'Dining', total_amount: 300 },   // 50% above 200
      { category: 'Shopping', total_amount: 400 }, // 100% above 200
    ]
    const history = [
      { year: 2026, month: 5, category: 'Dining', total: 200 },
      { year: 2026, month: 4, category: 'Dining', total: 200 },
      { year: 2026, month: 5, category: 'Shopping', total: 200 },
      { year: 2026, month: 4, category: 'Shopping', total: 200 },
    ]
    const result = computeAnomalies(current, history)
    expect(result[0].category).toBe('Shopping')
    expect(result[1].category).toBe('Dining')
  })
})

// ---------------------------------------------------------------------------
// BENCHMARK_RANGES / computeBenchmarkComparisons
// ---------------------------------------------------------------------------

describe('computeBenchmarkComparisons', () => {
  it('returns empty array when income is 0', () => {
    expect(computeBenchmarkComparisons([{ category: 'Dining', total_amount: 500 }], 0)).toEqual([])
  })

  it('skips categories not present in BENCHMARK_RANGES', () => {
    expect(computeBenchmarkComparisons([{ category: 'Some Custom Category', total_amount: 500 }], 5000)).toEqual([])
  })

  it('computes actualPct as a percentage of income', () => {
    const [result] = computeBenchmarkComparisons([{ category: 'Dining', total_amount: 250 }], 5000)
    expect(result.actualPct).toBeCloseTo(5, 5)
  })

  it('marks status "within" when inside the benchmark range', () => {
    const [lo, hi] = BENCHMARK_RANGES.Dining
    const midPct = (lo + hi) / 2
    const income = 10000
    const amount = (midPct / 100) * income
    const [result] = computeBenchmarkComparisons([{ category: 'Dining', total_amount: amount }], income)
    expect(result.status).toBe('within')
  })

  it('marks status "over" when above the benchmark range', () => {
    const [, hi] = BENCHMARK_RANGES.Dining
    const income = 10000
    const amount = ((hi + 10) / 100) * income
    const [result] = computeBenchmarkComparisons([{ category: 'Dining', total_amount: amount }], income)
    expect(result.status).toBe('over')
  })

  it('marks status "under" when below the benchmark range', () => {
    const [lo] = BENCHMARK_RANGES.Dining
    const income = 10000
    const amount = Math.max(0, (lo - 2) / 100) * income
    const [result] = computeBenchmarkComparisons([{ category: 'Dining', total_amount: amount }], income)
    expect(result.status).toBe('under')
  })
})

// ---------------------------------------------------------------------------
// computeRecurringMerchants / computeRecurringSplit
// ---------------------------------------------------------------------------

describe('computeRecurringMerchants', () => {
  it('returns an empty set for no transactions', () => {
    expect(computeRecurringMerchants([])).toEqual(new Set())
  })

  it('includes a merchant appearing in 2+ distinct months', () => {
    const txns = [
      makeTxn({ txn_type: 'expense', merchant: 'Netflix', date: '2026-01-15' }),
      makeTxn({ txn_type: 'expense', merchant: 'Netflix', date: '2026-02-15' }),
    ]
    expect(computeRecurringMerchants(txns).has('Netflix')).toBe(true)
  })

  it('excludes a merchant appearing in only one month', () => {
    const txns = [makeTxn({ txn_type: 'expense', merchant: 'Costco', date: '2026-01-15' })]
    expect(computeRecurringMerchants(txns).has('Costco')).toBe(false)
  })

  it('ignores non-expense transactions', () => {
    const txns = [
      makeTxn({ txn_type: 'income', merchant: 'Employer', date: '2026-01-15' }),
      makeTxn({ txn_type: 'income', merchant: 'Employer', date: '2026-02-15' }),
    ]
    expect(computeRecurringMerchants(txns).has('Employer')).toBe(false)
  })
})

describe('computeRecurringSplit', () => {
  it('returns zero for both buckets with no transactions', () => {
    expect(computeRecurringSplit([], new Set())).toEqual({ recurring: 0, oneTime: 0 })
  })

  it('buckets a recurring merchant into recurring total', () => {
    const txns = [makeTxn({ txn_type: 'expense', merchant: 'Netflix', amount: 15.99, date: '2026-06-15' })]
    const result = computeRecurringSplit(txns, new Set(['Netflix']))
    expect(result.recurring).toBeCloseTo(15.99, 2)
    expect(result.oneTime).toBe(0)
  })

  it('buckets a non-recurring merchant into oneTime total', () => {
    const txns = [makeTxn({ txn_type: 'expense', merchant: 'Costco', amount: 120, date: '2026-06-15' })]
    const result = computeRecurringSplit(txns, new Set(['Netflix']))
    expect(result.oneTime).toBe(120)
    expect(result.recurring).toBe(0)
  })

  it('sums multiple transactions into the correct buckets', () => {
    const txns = [
      makeTxn({ txn_type: 'expense', merchant: 'Netflix', amount: 16, date: '2026-06-01' }),
      makeTxn({ txn_type: 'expense', merchant: 'Spotify', amount: 10, date: '2026-06-02' }),
      makeTxn({ txn_type: 'expense', merchant: 'Costco', amount: 100, date: '2026-06-03' }),
    ]
    const result = computeRecurringSplit(txns, new Set(['Netflix', 'Spotify']))
    expect(result.recurring).toBe(26)
    expect(result.oneTime).toBe(100)
  })

  it('ignores non-expense transactions', () => {
    const txns = [makeTxn({ txn_type: 'income', merchant: 'Employer', amount: 5000, date: '2026-06-01' })]
    const result = computeRecurringSplit(txns, new Set())
    expect(result.recurring).toBe(0)
    expect(result.oneTime).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildSankeyLayout
// ---------------------------------------------------------------------------

// Expected gap-adjusted sink height for a flow, given its share of `scale`
// and how many sinks are in the diagram (n-1 gaps of SINK_GAP each).
function expectedSinkH(amount: number, scale: number, sinkCount: number): number {
  const availableH = 1 - SINK_GAP * Math.max(0, sinkCount - 1)
  return (amount / scale) * availableH
}

describe('buildSankeyLayout', () => {
  const normal = buildSankeyLayout(8000, 5000, 500, 1500)
  // remaining = 8000 - 5000 - 500 - 1500 = 1000

  describe('null cases', () => {
    it('returns null when income is 0', () => {
      expect(buildSankeyLayout(0, 0, 0, 0)).toBeNull()
    })

    it('returns null when income is negative', () => {
      expect(buildSankeyLayout(-1000, 500, 0, 0)).toBeNull()
    })
  })

  describe('sinks — normal case (all 4 flows)', () => {
    it('returns 4 sinks when all amounts are positive', () => {
      expect(normal!.sinks).toHaveLength(4)
    })

    it('sink labels are Expenses, Debt, Invested, Remaining in order', () => {
      expect(normal!.sinks.map(s => s.label)).toEqual(['Expenses', 'Debt', 'Invested', 'Remaining'])
    })

    it('carries the original dollar amounts on each sink', () => {
      expect(normal!.sinks[0].amount).toBe(5000)
      expect(normal!.sinks[1].amount).toBe(500)
      expect(normal!.sinks[2].amount).toBe(1500)
      expect(normal!.sinks[3].amount).toBe(1000)  // remaining
    })

    it('sink h values are proportional to income, minus room reserved for gaps', () => {
      expect(normal!.sinks[0].h).toBeCloseTo(expectedSinkH(5000, 8000, 4), 5)
      expect(normal!.sinks[1].h).toBeCloseTo(expectedSinkH(500, 8000, 4), 5)
      expect(normal!.sinks[2].h).toBeCloseTo(expectedSinkH(1500, 8000, 4), 5)
      expect(normal!.sinks[3].h).toBeCloseTo(expectedSinkH(1000, 8000, 4), 5)
    })

    it('sink h values plus gaps sum to 1.0 when spending fits within income', () => {
      const totalH = normal!.sinks.reduce((s, n) => s + n.h, 0)
      const totalGap = SINK_GAP * (normal!.sinks.length - 1)
      expect(totalH + totalGap).toBeCloseTo(1.0, 5)
    })

    it('sink y values stack with a gap between each: next sink starts SINK_GAP after the previous ended', () => {
      const s = normal!.sinks
      expect(s[0].y).toBeCloseTo(0, 5)
      expect(s[1].y).toBeCloseTo(s[0].y + s[0].h + SINK_GAP, 5)
      expect(s[2].y).toBeCloseTo(s[1].y + s[1].h + SINK_GAP, 5)
      expect(s[3].y).toBeCloseTo(s[2].y + s[2].h + SINK_GAP, 5)
    })
  })

  describe('links — ribbons fan from the undivided income bar to each gapped sink', () => {
    it('link count equals sink count', () => {
      expect(normal!.links).toHaveLength(normal!.sinks.length)
    })

    it('link ty/th match the target sink\'s own (gapped) geometry', () => {
      normal!.links.forEach((link, i) => {
        expect(link.ty).toBeCloseTo(normal!.sinks[i].y, 5)
        expect(link.th).toBeCloseTo(normal!.sinks[i].h, 5)
      })
    })

    it('link sy stacks tightly (no gaps) since the income bar itself is undivided', () => {
      const links = normal!.links
      expect(links[0].sy).toBeCloseTo(0, 5)
      expect(links[1].sy).toBeCloseTo(links[0].sy + links[0].sh, 5)
      expect(links[2].sy).toBeCloseTo(links[1].sy + links[1].sh, 5)
      expect(links[3].sy).toBeCloseTo(links[2].sy + links[2].sh, 5)
    })

    it('link sy/sh differ from ty/th when there is more than one sink — this is what gives ribbons real curvature', () => {
      // With a gap on the target side but none on the source side, a sink's
      // gapped position/height no longer matches its tightly-packed source share.
      const link = normal!.links[2] // third sink onward has accumulated gap offset
      expect(link.sy).not.toBeCloseTo(link.ty, 3)
    })

    it('link amounts mirror sink amounts', () => {
      normal!.links.forEach((link, i) => {
        expect(link.amount).toBe(normal!.sinks[i].amount)
      })
    })
  })

  describe('single-sink case: no gap needed, ribbon is a flat pass-through', () => {
    it('sy/sh match ty/th exactly when there is only one flow', () => {
      const layout = buildSankeyLayout(5000, 0, 0, 0)! // remaining = 5000, only 1 sink
      expect(layout.links).toHaveLength(1)
      expect(layout.links[0].sy).toBeCloseTo(layout.links[0].ty, 5)
      expect(layout.links[0].sh).toBeCloseTo(layout.links[0].th, 5)
    })
  })

  describe('hasNegative flag', () => {
    it('is false when remaining >= 0', () => {
      expect(normal!.hasNegative).toBe(false)
    })

    it('is true when spending exceeds income', () => {
      const layout = buildSankeyLayout(5000, 7000, 0, 0)
      expect(layout!.hasNegative).toBe(true)
    })

    it('is false when remaining is exactly 0', () => {
      const layout = buildSankeyLayout(8000, 5000, 1500, 1500)
      // remaining = 8000 - 5000 - 1500 - 1500 = 0
      expect(layout!.hasNegative).toBe(false)
    })
  })

  describe('zero-amount filtering', () => {
    it('filters out zero-amount sinks (e.g., debt = 0)', () => {
      const layout = buildSankeyLayout(8000, 5000, 0, 1500)
      expect(layout!.sinks.map(s => s.label)).not.toContain('Debt')
    })

    it('remaining is filtered out when over-spending (clamped to 0)', () => {
      const layout = buildSankeyLayout(5000, 7000, 0, 0)!
      expect(layout.sinks.map(s => s.label)).not.toContain('Remaining')
    })

    it('h values plus gaps still sum to 1.0 when some sinks are filtered', () => {
      const layout = buildSankeyLayout(8000, 5000, 0, 1500)! // no debt → 3 sinks
      const totalH = layout.sinks.reduce((s, n) => s + n.h, 0)
      const totalGap = SINK_GAP * (layout.sinks.length - 1)
      expect(totalH + totalGap).toBeCloseTo(1.0, 5)
    })
  })

  describe('income field', () => {
    it('carries income on the returned layout', () => {
      expect(normal!.income).toBe(8000)
    })
  })

  describe('over-budget scaling (spending exceeds income)', () => {
    it('sink h values (plus gaps) never exceed a total of 1.0, even when spending exceeds income', () => {
      const layout = buildSankeyLayout(5000, 7000, 500, 0)!
      const totalH = layout.sinks.reduce((s, n) => s + n.h, 0)
      const totalGap = SINK_GAP * (layout.sinks.length - 1)
      expect(totalH + totalGap).toBeLessThanOrEqual(1.0 + 1e-9)
    })

    it('sink h values plus gaps sum to exactly 1.0 when over budget (fills the diagram, no overflow)', () => {
      const layout = buildSankeyLayout(5000, 7000, 500, 0)!
      const totalH = layout.sinks.reduce((s, n) => s + n.h, 0)
      const totalGap = SINK_GAP * (layout.sinks.length - 1)
      expect(totalH + totalGap).toBeCloseTo(1.0, 5)
    })

    it('scales sink heights by total spend rather than income when over budget', () => {
      // total spend = 7500 on 5000 income → Expenses 7000/7500, Debt 500/7500, minus gap room
      const layout = buildSankeyLayout(5000, 7000, 500, 0)!
      expect(layout.sinks[0].h).toBeCloseTo(expectedSinkH(7000, 7500, 2), 5)
      expect(layout.sinks[1].h).toBeCloseTo(expectedSinkH(500, 7500, 2), 5)
    })

    it('adds sourceH representing income as a fraction of the scaled total', () => {
      const layout = buildSankeyLayout(5000, 7000, 500, 0)!
      expect(layout.sourceH).toBeCloseTo(5000 / 7500, 5)
    })

    it('sourceH is 1.0 (full height) when spending fits within income', () => {
      expect(normal!.sourceH).toBeCloseTo(1.0, 5)
    })
  })
})
