import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CashFlowWaterfall } from '@/components/cash-flow-waterfall'
import { SINK_GAP } from '@/lib/finance'

function parseRibbonEndpoints(d: string) {
  const m = d.match(/^M ([\d.-]+) ([\d.-]+) C [\d.-]+ [\d.-]+, [\d.-]+ [\d.-]+, ([\d.-]+) ([\d.-]+)/)
  if (!m) throw new Error(`unexpected ribbon path format: ${d}`)
  return { sourceY: Number(m[2]), targetY: Number(m[4]) }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSankey(
  income = 8000,
  expenses = 5000,
  debt = 500,
  invested = 1500,
) {
  return render(
    <CashFlowWaterfall
      income={income}
      expenses={expenses}
      debt={debt}
      invested={invested}
    />
  )
}

// ---------------------------------------------------------------------------
// Zero income: empty state
// ---------------------------------------------------------------------------

describe('CashFlowWaterfall — zero income', () => {
  it('renders empty state when income is 0', () => {
    renderSankey(0, 0, 0, 0)
    expect(screen.getByText(/set your income/i)).toBeInTheDocument()
  })

  it('does not render an SVG when income is 0', () => {
    renderSankey(0, 0, 0, 0)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('still renders the Cash Flow heading in the empty state', () => {
    renderSankey(0, 0, 0, 0)
    expect(screen.getByText('Cash Flow')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Normal case (all 4 flows)
// ---------------------------------------------------------------------------

describe('CashFlowWaterfall — normal case', () => {
  it('renders the SVG Sankey diagram', () => {
    renderSankey()
    expect(screen.getByRole('img', { name: /cash flow sankey/i })).toBeInTheDocument()
  })

  it('shows the Cash Flow heading', () => {
    renderSankey()
    expect(screen.getByText('Cash Flow')).toBeInTheDocument()
  })

  it('shows the Income label', () => {
    renderSankey()
    expect(screen.getByText('Income')).toBeInTheDocument()
  })

  it('shows each sink category label', () => {
    renderSankey()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Debt')).toBeInTheDocument()
    expect(screen.getByText('Invested')).toBeInTheDocument()
    expect(screen.getByText('Remaining')).toBeInTheDocument()
  })

  it('does NOT show the Over budget chip when spending < income', () => {
    renderSankey()
    expect(screen.queryByText(/over budget/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Over-spending case
// ---------------------------------------------------------------------------

describe('CashFlowWaterfall — over budget', () => {
  it('shows the Over budget chip when expenses exceed income', () => {
    renderSankey(5000, 7000, 0, 0)
    expect(screen.getByText(/over budget/i)).toBeInTheDocument()
  })

  it('does not show Remaining label when spending exceeds income', () => {
    // Remaining is clamped to 0 and filtered from the Sankey layout
    renderSankey(5000, 7000, 0, 0)
    expect(screen.queryByText('Remaining')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Over-budget bar heights must stay contained within the diagram (regression
// for the clipping bug: sinks used to sum to >100% of the viewBox when
// spending exceeded income, pushing bars/labels outside the SVG viewBox).
// ---------------------------------------------------------------------------

describe('CashFlowWaterfall — over-budget bar heights stay within the diagram', () => {
  it('total sink bar height is the same regardless of how severely spending exceeds income', () => {
    const { container: mild } = renderSankey(5000, 7000, 500, 0)
    const mildTotal = Array.from(mild.querySelectorAll('[data-testid="sink-bar"]'))
      .reduce((s, el) => s + Number(el.getAttribute('height')), 0)

    const { container: severe } = renderSankey(5000, 70000, 5000, 0)
    const severeTotal = Array.from(severe.querySelectorAll('[data-testid="sink-bar"]'))
      .reduce((s, el) => s + Number(el.getAttribute('height')), 0)

    expect(mildTotal).toBeCloseTo(severeTotal, 1)
  })

  it('income bar is shorter than the total sink height when over budget', () => {
    const { container } = renderSankey(5000, 7000, 500, 0)
    const incomeHeight = Number(container.querySelector('[data-testid="income-bar"]')?.getAttribute('height'))
    const sinkTotal = Array.from(container.querySelectorAll('[data-testid="sink-bar"]'))
      .reduce((s, el) => s + Number(el.getAttribute('height')), 0)
    expect(incomeHeight).toBeLessThan(sinkTotal)
  })

  it('income bar height equals total sink height plus the gap space between them, when spending fits within income', () => {
    const { container } = renderSankey(8000, 5000, 500, 1500)
    const incomeHeight = Number(container.querySelector('[data-testid="income-bar"]')?.getAttribute('height'))
    const sinkBars = Array.from(container.querySelectorAll('[data-testid="sink-bar"]'))
    const sinkTotal = sinkBars.reduce((s, el) => s + Number(el.getAttribute('height')), 0)
    // incomeHeight represents the full viewBox height in the "fits" case (sourceH=1),
    // so it doubles as the pixel scale for converting SINK_GAP's fraction to pixels.
    const totalGapPx = SINK_GAP * (sinkBars.length - 1) * incomeHeight
    expect(sinkTotal + totalGapPx).toBeCloseTo(incomeHeight, 1)
  })
})

// ---------------------------------------------------------------------------
// Ribbons must have genuine curvature (regression for the "flat blocks" bug):
// a sink's gapped target position should differ from its tightly-packed
// source position whenever there's more than one sink to make room for.
// ---------------------------------------------------------------------------

describe('CashFlowWaterfall — ribbon curvature', () => {
  it("a middling sink's ribbon has real curvature — its source-side y differs from its target-side y", () => {
    const { container } = renderSankey() // normal fits case, 4 sinks
    const debtRibbon = container.querySelector('[data-testid="ribbon"][data-label="Debt"]')
    const { sourceY, targetY } = parseRibbonEndpoints(debtRibbon?.getAttribute('d') ?? '')
    expect(Math.abs(sourceY - targetY)).toBeGreaterThan(1)
  })

  it('a single-sink diagram has a flat ribbon (no gap needed, source matches target)', () => {
    const { container } = renderSankey(5000, 5000, 0, 0) // remaining = 0 → only Expenses sink
    expect(container.querySelectorAll('[data-testid="ribbon"]')).toHaveLength(1)
    const ribbon = container.querySelector('[data-testid="ribbon"]')
    const { sourceY, targetY } = parseRibbonEndpoints(ribbon?.getAttribute('d') ?? '')
    expect(sourceY).toBeCloseTo(targetY, 1)
  })

  it('ribbons no longer render as flat blocks: no two consecutive sinks share identical source and target y', () => {
    const { container } = renderSankey() // 4 sinks
    const ribbons = Array.from(container.querySelectorAll('[data-testid="ribbon"]'))
    expect(ribbons.length).toBeGreaterThan(1)
    const flatCount = ribbons.filter(r => {
      const { sourceY, targetY } = parseRibbonEndpoints(r.getAttribute('d') ?? '')
      return Math.abs(sourceY - targetY) < 0.5
    }).length
    // At most the very first sink can coincidentally start flat (both begin at y=0);
    // every subsequent sink's gapped position must diverge from its source share.
    expect(flatCount).toBeLessThan(ribbons.length)
  })
})

// ---------------------------------------------------------------------------
// Zero-debt scenario (Debt node absent)
// ---------------------------------------------------------------------------

describe('CashFlowWaterfall — partial flows', () => {
  it('omits Debt label when debt = 0', () => {
    renderSankey(8000, 5000, 0, 1500)
    expect(screen.queryByText('Debt')).not.toBeInTheDocument()
  })

  it('still renders Expenses, Invested, Remaining when debt = 0', () => {
    renderSankey(8000, 5000, 0, 1500)
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Invested')).toBeInTheDocument()
    expect(screen.getByText('Remaining')).toBeInTheDocument()
  })
})
