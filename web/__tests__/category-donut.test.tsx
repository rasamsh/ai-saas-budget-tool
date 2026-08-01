import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CategoryDonutInner from '@/components/_category-donut-inner'
import type { CategorySlice } from '@/components/category-donut'

const groceries: CategorySlice = { category: 'Groceries', total_amount: 500, color: '#22c55e' }
const dining: CategorySlice = { category: 'Dining', total_amount: 250, color: '#f97316' }
const custom: CategorySlice = { category: 'Pet Care', total_amount: 100, color: '#6b7280' }

describe('CategoryDonutInner — legend rendering', () => {
  it('renders a legend row for each category', () => {
    render(<CategoryDonutInner categoryTotals={[groceries, dining]} />)
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Dining')).toBeInTheDocument()
  })
})

describe('CategoryDonutInner — benchmark line', () => {
  it('does not show a benchmark line when income is not provided', () => {
    render(<CategoryDonutInner categoryTotals={[dining]} />)
    expect(screen.queryByText(/typical/i)).not.toBeInTheDocument()
  })

  it('does not show a benchmark line when income is 0', () => {
    render(<CategoryDonutInner categoryTotals={[dining]} income={0} />)
    expect(screen.queryByText(/typical/i)).not.toBeInTheDocument()
  })

  it('shows a benchmark line for a category with a known range', () => {
    // Dining = $250 on $5000 income = 5% of income; Dining range is 3-8%
    render(<CategoryDonutInner categoryTotals={[dining]} income={5000} />)
    expect(screen.getByText(/5\.0% of income/)).toBeInTheDocument()
    expect(screen.getByText(/typical 3–8%/)).toBeInTheDocument()
  })

  it('does not show a benchmark line for a category with no known range', () => {
    render(<CategoryDonutInner categoryTotals={[custom]} income={5000} />)
    expect(screen.queryByText(/typical/i)).not.toBeInTheDocument()
  })

  it('flags spend above the typical range', () => {
    // Dining = $1000 on $5000 income = 20% of income, well above the 3-8% range
    const heavyDining: CategorySlice = { ...dining, total_amount: 1000 }
    render(<CategoryDonutInner categoryTotals={[heavyDining]} income={5000} />)
    expect(screen.getByText(/above typical/i)).toBeInTheDocument()
  })

  it('does not flag spend within the typical range', () => {
    render(<CategoryDonutInner categoryTotals={[dining]} income={5000} />)
    expect(screen.queryByText(/above typical/i)).not.toBeInTheDocument()
  })
})
