import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayHeatmap } from '@/components/day-heatmap'

describe('DayHeatmap — rendering', () => {
  it('renders one cell per day in the month', () => {
    render(<DayHeatmap dailyTotals={Array(30).fill(0)} />)
    expect(screen.getAllByTestId('heatmap-cell')).toHaveLength(30)
  })

  it('renders 28 cells for a February with no leap day', () => {
    render(<DayHeatmap dailyTotals={Array(28).fill(0)} />)
    expect(screen.getAllByTestId('heatmap-cell')).toHaveLength(28)
  })

  it('renders 31 cells for a 31-day month', () => {
    render(<DayHeatmap dailyTotals={Array(31).fill(0)} />)
    expect(screen.getAllByTestId('heatmap-cell')).toHaveLength(31)
  })

  it('shows the heading', () => {
    render(<DayHeatmap dailyTotals={Array(30).fill(0)} />)
    expect(screen.getByText('Daily Spending')).toBeInTheDocument()
  })

  it('shows an empty state when every day has zero spend', () => {
    render(<DayHeatmap dailyTotals={Array(30).fill(0)} />)
    expect(screen.getByText(/no expenses recorded/i)).toBeInTheDocument()
  })

  it('does not show the empty state when at least one day has spend', () => {
    const totals = Array(30).fill(0)
    totals[4] = 50
    render(<DayHeatmap dailyTotals={totals} />)
    expect(screen.queryByText(/no expenses recorded/i)).not.toBeInTheDocument()
  })
})

describe('DayHeatmap — cell labels and values', () => {
  it('labels each cell with its day number', () => {
    render(<DayHeatmap dailyTotals={Array(5).fill(0)} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('sets a title tooltip with the formatted dollar amount for a spend day', () => {
    const totals = [0, 0, 123.45, 0, 0]
    render(<DayHeatmap dailyTotals={totals} />)
    const cells = screen.getAllByTestId('heatmap-cell')
    expect(cells[2]).toHaveAttribute('title', expect.stringContaining('$123.45'))
  })

  it('sets a title tooltip indicating no spend for a zero day', () => {
    const totals = [0, 50, 0, 0, 0]
    render(<DayHeatmap dailyTotals={totals} />)
    const cells = screen.getAllByTestId('heatmap-cell')
    expect(cells[0]).toHaveAttribute('title', expect.stringMatching(/no spend/i))
  })
})

describe('DayHeatmap — intensity scaling', () => {
  it('gives the highest-spend day the strongest opacity', () => {
    const totals = [10, 100, 50]
    render(<DayHeatmap dailyTotals={totals} />)
    const cells = screen.getAllByTestId('heatmap-cell')
    const opacityOf = (el: HTMLElement) => parseFloat(el.style.getPropertyValue('--intensity'))
    expect(opacityOf(cells[1])).toBeGreaterThan(opacityOf(cells[0]))
    expect(opacityOf(cells[1])).toBeGreaterThan(opacityOf(cells[2]))
  })

  it('gives a zero-spend day baseline (zero) intensity', () => {
    const totals = [0, 100]
    render(<DayHeatmap dailyTotals={totals} />)
    const cells = screen.getAllByTestId('heatmap-cell')
    expect(cells[0].style.getPropertyValue('--intensity')).toBe('0')
  })

  it('gives the max-spend day full intensity (1)', () => {
    const totals = [0, 100]
    render(<DayHeatmap dailyTotals={totals} />)
    const cells = screen.getAllByTestId('heatmap-cell')
    expect(cells[1].style.getPropertyValue('--intensity')).toBe('1')
  })

  it('does not throw when all totals are zero (avoids divide-by-zero)', () => {
    expect(() => render(<DayHeatmap dailyTotals={Array(10).fill(0)} />)).not.toThrow()
  })
})
