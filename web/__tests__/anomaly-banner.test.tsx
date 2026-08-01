import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnomalyBanner } from '@/components/anomaly-banner'
import type { Anomaly } from '@/lib/finance'

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    category: 'Dining',
    current: 340,
    average: 200,
    pctAboveAverage: 70,
    ...overrides,
  }
}

describe('AnomalyBanner — empty state', () => {
  it('renders nothing when there are no anomalies', () => {
    const { container } = render(<AnomalyBanner anomalies={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('AnomalyBanner — with anomalies', () => {
  it('shows the category name', () => {
    render(<AnomalyBanner anomalies={[makeAnomaly({ category: 'Dining' })]} />)
    expect(screen.getByText('Dining')).toBeInTheDocument()
  })

  it('shows the percentage above average, rounded', () => {
    render(<AnomalyBanner anomalies={[makeAnomaly({ pctAboveAverage: 70.4 })]} />)
    expect(screen.getByText(/70% above/i)).toBeInTheDocument()
  })

  it('shows the current and average dollar amounts', () => {
    render(<AnomalyBanner anomalies={[makeAnomaly({ current: 340, average: 200 })]} />)
    expect(screen.getByText(/\$340/)).toBeInTheDocument()
    expect(screen.getByText(/\$200/)).toBeInTheDocument()
  })

  it('shows at most 3 anomalies even when more are passed', () => {
    const anomalies = [
      makeAnomaly({ category: 'Dining' }),
      makeAnomaly({ category: 'Shopping' }),
      makeAnomaly({ category: 'Travel' }),
      makeAnomaly({ category: 'Utilities' }),
    ]
    render(<AnomalyBanner anomalies={anomalies} />)
    expect(screen.getByText('Dining')).toBeInTheDocument()
    expect(screen.getByText('Shopping')).toBeInTheDocument()
    expect(screen.getByText('Travel')).toBeInTheDocument()
    expect(screen.queryByText('Utilities')).not.toBeInTheDocument()
  })
})
