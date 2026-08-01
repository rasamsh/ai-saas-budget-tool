import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCurrencyExact,
  formatSavingsRate,
  monthName,
  shortMonthName,
  calcTrend,
} from '@/lib/utils'

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe('formatCurrency', () => {
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('formats whole dollar amounts without cents', () => {
    expect(formatCurrency(1000)).toBe('$1,000')
  })

  it('rounds cents (maximumFractionDigits: 0)', () => {
    expect(formatCurrency(99.99)).toBe('$100')
  })

  it('formats large amounts with commas', () => {
    expect(formatCurrency(12345.67)).toBe('$12,346')
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-500)).toBe('-$500')
  })
})

// ---------------------------------------------------------------------------
// formatCurrencyExact
// ---------------------------------------------------------------------------
describe('formatCurrencyExact', () => {
  it('shows two decimal places', () => {
    expect(formatCurrencyExact(10)).toBe('$10.00')
  })

  it('preserves cents', () => {
    expect(formatCurrencyExact(5.75)).toBe('$5.75')
  })

  it('rounds to two decimal places', () => {
    expect(formatCurrencyExact(1.005)).toBe('$1.01')
  })

  it('formats zero as $0.00', () => {
    expect(formatCurrencyExact(0)).toBe('$0.00')
  })
})

// ---------------------------------------------------------------------------
// formatSavingsRate
// ---------------------------------------------------------------------------
describe('formatSavingsRate', () => {
  it('returns em-dash for null', () => {
    expect(formatSavingsRate(null)).toBe('—')
  })

  it('formats positive rate with one decimal', () => {
    expect(formatSavingsRate(42.5)).toBe('42.5%')
  })

  it('formats negative rate', () => {
    expect(formatSavingsRate(-10.3)).toBe('-10.3%')
  })

  it('formats zero', () => {
    expect(formatSavingsRate(0)).toBe('0.0%')
  })

  it('formats 100%', () => {
    expect(formatSavingsRate(100)).toBe('100.0%')
  })
})

// ---------------------------------------------------------------------------
// monthName
// ---------------------------------------------------------------------------
describe('monthName', () => {
  it('returns January for 1', () => expect(monthName(1)).toBe('January'))
  it('returns June for 6', () => expect(monthName(6)).toBe('June'))
  it('returns December for 12', () => expect(monthName(12)).toBe('December'))
  it('returns empty string for out-of-range', () => expect(monthName(13)).toBe(''))
  it('returns empty string for 0', () => expect(monthName(0)).toBe(''))
})

// ---------------------------------------------------------------------------
// shortMonthName
// ---------------------------------------------------------------------------
describe('shortMonthName', () => {
  it('returns first 3 chars of full month name', () => {
    expect(shortMonthName(1)).toBe('Jan')
    expect(shortMonthName(6)).toBe('Jun')
    expect(shortMonthName(12)).toBe('Dec')
  })
})

// ---------------------------------------------------------------------------
// calcTrend
// ---------------------------------------------------------------------------
describe('calcTrend', () => {
  const label = 'vs 2025'

  describe('returns null when prior is missing or zero', () => {
    it('null prior', () => expect(calcTrend(100, null, true, label)).toBeNull())
    it('undefined prior', () => expect(calcTrend(100, undefined, true, label)).toBeNull())
    it('zero prior', () => expect(calcTrend(100, 0, true, label)).toBeNull())
  })

  describe('direction', () => {
    it('up when current > prior', () => {
      const t = calcTrend(120, 100, true, label)!
      expect(t.direction).toBe('up')
    })

    it('down when current < prior', () => {
      const t = calcTrend(80, 100, true, label)!
      expect(t.direction).toBe('down')
    })

    it('flat when change is under 0.5%', () => {
      const t = calcTrend(100.4, 100, true, label)!
      expect(t.direction).toBe('flat')
    })
  })

  describe('percentage calculation', () => {
    it('computes 20% increase correctly', () => {
      const t = calcTrend(120, 100, true, label)!
      expect(t.pct).toBeCloseTo(20, 1)
    })

    it('computes 50% decrease correctly', () => {
      const t = calcTrend(50, 100, true, label)!
      expect(t.pct).toBeCloseTo(50, 1)
    })

    it('pct is always the absolute value', () => {
      const t = calcTrend(80, 100, true, label)!
      expect(t.pct).toBeGreaterThan(0)
    })
  })

  describe('isPositive flag', () => {
    it('preserves isPositive: true', () => {
      const t = calcTrend(120, 100, true, label)!
      expect(t.isPositive).toBe(true)
    })

    it('preserves isPositive: false', () => {
      const t = calcTrend(120, 100, false, label)!
      expect(t.isPositive).toBe(false)
    })
  })

  describe('label', () => {
    it('carries the label through unchanged', () => {
      const t = calcTrend(120, 100, true, 'vs Jun \'25')!
      expect(t.label).toBe('vs Jun \'25')
    })
  })

  describe('pct cap at 999', () => {
    it('caps pct at 999 when change is extreme', () => {
      // savings rate from -1% to -100%: raw = (-100 - (-1)) / |-1| * 100 = -9900%
      // without cap this would show "↓ 9900.0% vs 2025" — misleading on screen
      const t = calcTrend(-100, -1, true, label)!
      expect(t.pct).toBe(999)
    })

    it('does not cap normal percentages', () => {
      const t = calcTrend(150, 100, true, label)!
      expect(t.pct).toBeCloseTo(50, 1)
    })

    it('caps at exactly 999, not higher', () => {
      // 10x increase: (1000 - 1) / 1 * 100 = 99900%
      const t = calcTrend(1000, 1, true, label)!
      expect(t.pct).toBe(999)
    })
  })

  describe('color semantics — isPositive: true (income, savings)', () => {
    it('up trend is a positive signal', () => {
      const t = calcTrend(120, 100, true, label)!
      // up + isPositive = good (green)
      const isGood = t.direction === 'up' && t.isPositive
      expect(isGood).toBe(true)
    })

    it('down trend is a negative signal', () => {
      const t = calcTrend(80, 100, true, label)!
      // down + isPositive = bad (red)
      const isBad = t.direction === 'down' && t.isPositive
      expect(isBad).toBe(true)
    })
  })

  describe('color semantics — isPositive: false (expenses, debt)', () => {
    it('up trend is a negative signal', () => {
      const t = calcTrend(120, 100, false, label)!
      // up + !isPositive = bad (red)
      const isBad = t.direction === 'up' && !t.isPositive
      expect(isBad).toBe(true)
    })

    it('down trend is a positive signal', () => {
      const t = calcTrend(80, 100, false, label)!
      // down + !isPositive = good (green)
      const isGood = t.direction === 'down' && !t.isPositive
      expect(isGood).toBe(true)
    })
  })
})
