import { describe, it, expect } from 'vitest'
import { unrecognizedIncomeWarnings } from '@/lib/import/warnings'
import { cleanMerchant } from '@/lib/import/clean-merchant'
import type { ParsedTransaction } from '@/lib/import/types'
import type { TxnType } from '@/lib/supabase/types'

function txn(description: string, txnType: TxnType = 'income'): ParsedTransaction {
  return {
    date: '2026-07-22',
    description,
    merchant: cleanMerchant(description),
    amount: 3900,
    account: 'Chase Checking',
    bank: 'chase',
    category: txnType === 'income' ? 'Income' : 'Misc',
    txnType,
    hash: '',
  }
}

describe('unrecognizedIncomeWarnings', () => {
  it('flags a credit from a source no income pattern recognizes', () => {
    const [warning] = unrecognizedIncomeWarnings([
      txn('Online Transfer From Chk ...5546 transaction#: 29871676506 07/22'),
    ])
    expect(warning).toContain('1 credit')
    expect(warning).toContain('Online Transfer From Chk')
  })

  it('stays quiet for recognized income', () => {
    expect(unrecognizedIncomeWarnings([txn('American Express PAYROLL PPD ID: 1133133497')])).toEqual([])
  })

  it('ignores expenses entirely', () => {
    expect(unrecognizedIncomeWarnings([txn('ZZZ UNKNOWN MERCHANT', 'expense')])).toEqual([])
  })

  it('counts every credit but lists each merchant once', () => {
    const [warning] = unrecognizedIncomeWarnings([
      txn('Online Transfer From Chk ...5546 transaction#: 1 07/22'),
      txn('Online Transfer From Chk ...5546 transaction#: 2 07/23'),
    ])
    expect(warning).toContain('2 credits')
    expect(warning.match(/Online Transfer From Chk/g)).toHaveLength(1)
  })
})
