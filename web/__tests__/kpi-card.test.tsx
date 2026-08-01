import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCard } from '@/components/kpi-card'
import type { Trend } from '@/lib/utils'

const upGoodTrend: Trend    = { pct: 18.4, direction: 'up',   isPositive: true,  label: 'vs 2025' }
const upBadTrend: Trend     = { pct: 20.5, direction: 'up',   isPositive: false, label: 'vs 2025' }
const downGoodTrend: Trend  = { pct: 15.3, direction: 'down', isPositive: false, label: 'vs Jun \'25' }
const downBadTrend: Trend   = { pct: 8.1,  direction: 'down', isPositive: true,  label: 'vs Jun \'25' }
const flatTrend: Trend      = { pct: 0,    direction: 'flat', isPositive: true,  label: 'vs 2025' }

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------
describe('KpiCard — basic rendering', () => {
  it('renders the label', () => {
    render(<KpiCard label="Expenses" value="$5,000" />)
    expect(screen.getByText('Expenses')).toBeInTheDocument()
  })

  it('renders the value', () => {
    render(<KpiCard label="Expenses" value="$5,000" />)
    expect(screen.getByText('$5,000')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<KpiCard label="Income" value="$8,000" subtitle="$96,000 / yr" />)
    expect(screen.getByText('$96,000 / yr')).toBeInTheDocument()
  })

  it('does not render subtitle when omitted', () => {
    render(<KpiCard label="Expenses" value="$5,000" />)
    expect(screen.queryByText(/yr/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// isNull state
// ---------------------------------------------------------------------------
describe('KpiCard — isNull state', () => {
  it('shows em-dash when isNull', () => {
    render(<KpiCard label="Savings Rate" value="42.5%" isNull />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('does not show the value when isNull', () => {
    render(<KpiCard label="Savings Rate" value="42.5%" isNull />)
    expect(screen.queryByText('42.5%')).not.toBeInTheDocument()
  })

  it('suppresses trend badge when isNull even if trend is provided', () => {
    render(<KpiCard label="Expenses" value="$5,000" isNull trend={upBadTrend} />)
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument()
    expect(screen.queryByText(/↓/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Trend badge — arrow symbols
// ---------------------------------------------------------------------------
describe('KpiCard — trend badge arrows', () => {
  it('renders ↑ for up direction', () => {
    render(<KpiCard label="Expenses" value="$5,000" trend={upBadTrend} />)
    expect(screen.getByText(/↑/)).toBeInTheDocument()
  })

  it('renders ↓ for down direction', () => {
    render(<KpiCard label="Expenses" value="$5,000" trend={downGoodTrend} />)
    expect(screen.getByText(/↓/)).toBeInTheDocument()
  })

  it('renders → for flat direction', () => {
    render(<KpiCard label="Income" value="$8,000" trend={flatTrend} />)
    expect(screen.getByText(/→/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Trend badge — percentage display
// ---------------------------------------------------------------------------
describe('KpiCard — trend badge percentage', () => {
  it('shows percentage for up trend', () => {
    render(<KpiCard label="Expenses" value="$5,000" trend={upBadTrend} />)
    expect(screen.getByText(/20\.5%/)).toBeInTheDocument()
  })

  it('shows ~0% for flat trend', () => {
    render(<KpiCard label="Income" value="$8,000" trend={flatTrend} />)
    expect(screen.getByText(/~0%/)).toBeInTheDocument()
  })

  it('shows the label text', () => {
    render(<KpiCard label="Expenses" value="$5,000" trend={upBadTrend} />)
    expect(screen.getByText(/vs 2025/)).toBeInTheDocument()
  })

  it('shows month-style label', () => {
    render(<KpiCard label="Expenses" value="$5,000" trend={downGoodTrend} />)
    expect(screen.getByText(/vs Jun '25/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Trend badge — color semantics
// ---------------------------------------------------------------------------
describe('KpiCard — trend badge color semantics', () => {
  it('up + isPositive (income going up) renders green class', () => {
    render(<KpiCard label="Income" value="$8,000" trend={upGoodTrend} />)
    const badge = screen.getByText(/↑/)
    expect(badge.className).toContain('green')
  })

  it('up + !isPositive (expenses going up) renders red class', () => {
    render(<KpiCard label="Expenses" value="$5,000" trend={upBadTrend} />)
    const badge = screen.getByText(/↑/)
    expect(badge.className).toContain('red')
  })

  it('down + !isPositive (expenses going down) renders green class', () => {
    render(<KpiCard label="Expenses" value="$5,000" trend={downGoodTrend} />)
    const badge = screen.getByText(/↓/)
    expect(badge.className).toContain('green')
  })

  it('down + isPositive (income going down) renders red class', () => {
    render(<KpiCard label="Income" value="$8,000" trend={downBadTrend} />)
    const badge = screen.getByText(/↓/)
    expect(badge.className).toContain('red')
  })

  it('flat direction renders muted class (neither red nor green)', () => {
    render(<KpiCard label="Income" value="$8,000" trend={flatTrend} />)
    const badge = screen.getByText(/→/)
    expect(badge.className).not.toContain('green')
    expect(badge.className).not.toContain('red')
  })
})

// ---------------------------------------------------------------------------
// No trend
// ---------------------------------------------------------------------------
describe('KpiCard — no trend', () => {
  it('renders nothing trend-related when trend is undefined', () => {
    render(<KpiCard label="Expenses" value="$5,000" />)
    expect(screen.queryByText(/↑|↓|→/)).not.toBeInTheDocument()
    expect(screen.queryByText(/vs/)).not.toBeInTheDocument()
  })

  it('renders nothing when trend is null', () => {
    render(<KpiCard label="Expenses" value="$5,000" trend={null} />)
    expect(screen.queryByText(/↑|↓|→/)).not.toBeInTheDocument()
  })
})
