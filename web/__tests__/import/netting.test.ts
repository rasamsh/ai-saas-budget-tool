import { describe, it, expect } from 'vitest'
import { netRefunds } from '@/lib/import/netting'
import type { ParsedTransaction } from '@/lib/import/types'

function t(description: string, amount: number): ParsedTransaction {
  return {
    date: '2026-06-15',
    description,
    merchant: description,
    amount,
    account: 'Amex Blue',
    bank: 'amex',
    category: 'Misc',
    txnType: 'expense',
    hash: '',
  }
}

describe('netRefunds', () => {
  it('pass 1: matches on description + amount', () => {
    const expenses = [t('STARBUCKS', 6.5), t('AMAZON', 49.99)]
    const refunds = [t('STARBUCKS', 6.5)]
    const out = netRefunds(expenses, refunds)
    expect(out).toHaveLength(1)
    expect(out[0].description).toBe('AMAZON')
  })

  it('pass 2: matches on amount alone when description differs', () => {
    const expenses = [t('FOO', 10)]
    const refunds = [t('BAR', 10)]
    expect(netRefunds(expenses, refunds)).toHaveLength(0)
  })

  it('each refund consumed at most once (duplicate refunds)', () => {
    const expenses = [t('COFFEE', 5), t('COFFEE', 5)]
    const refunds = [t('COFFEE', 5)] // only one refund
    const out = netRefunds(expenses, refunds)
    expect(out).toHaveLength(1) // only one expense netted
  })

  it('leftover refunds are ignored, not added as transactions', () => {
    const expenses = [t('COFFEE', 5)]
    const refunds = [t('COFFEE', 5), t('COFFEE', 5)]
    const out = netRefunds(expenses, refunds)
    expect(out).toHaveLength(0)
  })

  it('pass 1 preferred over pass 2', () => {
    // Two expenses at 10; one refund matches description "A" exactly.
    const expenses = [t('A', 10), t('B', 10)]
    const refunds = [t('B', 10)]
    const out = netRefunds(expenses, refunds)
    // B is netted by exact match; A remains.
    expect(out.map(x => x.description)).toEqual(['A'])
  })
})
