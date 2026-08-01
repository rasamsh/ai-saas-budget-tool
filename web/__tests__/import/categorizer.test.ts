import { describe, it, expect } from 'vitest'
import { categorize } from '@/lib/import/categorizer'
import { cleanMerchant } from '@/lib/import/clean-merchant'
import { CATEGORY_RULES } from '@/lib/import/rules'
import type { CategoryRules, ParsedTransaction } from '@/lib/import/types'
import type { TxnType } from '@/lib/supabase/types'

// Ported from budget-pipeline/tests/test_categorizer.py (categorize cases).

function txn(description: string, amount = 10, txnType: TxnType = 'expense'): ParsedTransaction {
  return {
    date: '2026-06-15',
    description,
    merchant: cleanMerchant(description),
    amount,
    account: 'Chase Checking',
    bank: 'chase',
    category: 'Misc',
    txnType,
    hash: '',
  }
}

describe('categorize — pattern rules', () => {
  it.each([
    ['WHOLE FOODS MARKET 123', 'Groceries', 'expense'],
    ['STARBUCKS STORE 123456789', 'Dining', 'expense'],
    ['AMAZON MKTPL 1234567890', 'Shopping', 'expense'],
    ['NETFLIX.COM WEB ID: 1234567890', 'Subscriptions', 'expense'],
    ['M1 PAYMENTS PPD ID: 8327952000', 'Taxable Brokerage', 'investment'],
    ['DOORDASH BURGERKING', 'Dining', 'expense'],
    ['UBER TRIP HELP.UBER.COM', 'Transportation', 'expense'],
    ['GEICO *AUTO INSURANCE', 'Car Insurance', 'expense'],
    ['SOUTHWEST GAS BILLPAY WEB ID: 123', 'Utilities', 'expense'],
    ['netflix.com', 'Subscriptions', 'expense'],
  ])('%s -> %s/%s', (desc, cat, type) => {
    const r = categorize(txn(desc), CATEGORY_RULES)
    expect(r.category).toBe(cat)
    expect(r.txnType).toBe(type)
  })
})

describe('categorize — amount rules', () => {
  const custom: CategoryRules = {
    categories: [],
    rules: [{ pattern: 'NETFLIX', category: 'Subscriptions', type: 'expense' }],
    amount_rules: [{ amount: 15.99, category: 'Car Loan', type: 'debt' }],
    income_patterns: [],
  }
  it('amount rule beats pattern rule', () => {
    const r = categorize(txn('NETFLIX', 15.99), custom)
    expect(r.category).toBe('Car Loan')
    expect(r.txnType).toBe('debt')
  })
  it('does not fire on wrong amount', () => {
    const rules: CategoryRules = {
      categories: [],
      rules: [],
      amount_rules: [{ amount: 688.76, category: 'Car Loan', type: 'debt' }],
      income_patterns: [],
    }
    expect(categorize(txn('SOME PAYMENT', 500), rules).category).toBe('Misc')
  })
  it('empty amount rules skipped gracefully', () => {
    const rules = { ...CATEGORY_RULES, amount_rules: [] }
    expect(categorize(txn('STARBUCKS'), rules).category).toBe('Dining')
  })
})

describe('categorize — credits keep their direction', () => {
  it('payroll credit stays income', () => {
    const r = categorize(txn('DIRECT DEPOSIT PAYROLL', 10, 'income'), CATEGORY_RULES)
    expect(r.category).toBe('Income')
    expect(r.txnType).toBe('income')
  })
  it('unrecognized credit stays income, never flips to expense', () => {
    const r = categorize(txn('RANDOM CREDIT FROM UNKNOWN', 10, 'income'), CATEGORY_RULES)
    expect(r.txnType).toBe('income')
    expect(r.category).toBe('Income')
  })
  it('zelle from is income', () => {
    expect(categorize(txn('ZELLE FROM JOHN DOE', 10, 'income'), CATEGORY_RULES).txnType).toBe('income')
  })
  it('gusto payroll is income', () => {
    expect(categorize(txn('GUSTO PAYROLL 123456', 10, 'income'), CATEGORY_RULES).txnType).toBe('income')
  })

  // The reported bug: an incoming ACH transfer on Chase checking was stored as a
  // -$3,900 Misc expense, a $7,800 swing in net cash flow.
  it('incoming Chase transfer is income, not a Misc expense', () => {
    const r = categorize(
      txn('Online Transfer From Chk ...5546 transaction#: 29871676506 07/22', 3900, 'income'),
      CATEGORY_RULES,
    )
    expect(r.txnType).toBe('income')
    expect(r.category).toBe('Income')
  })

  it('a spending pattern rule cannot claim a credit', () => {
    // An Amazon refund landing in checking is money IN, whatever the payee says.
    const r = categorize(txn('AMAZON.COM REFUND 12345', 42, 'income'), CATEGORY_RULES)
    expect(r.txnType).toBe('income')
    expect(r.category).toBe('Income')
    // ...while the same payee on a debit is still Shopping.
    expect(categorize(txn('AMAZON.COM PURCHASE 12345', 42), CATEGORY_RULES).category).toBe('Shopping')
  })

  it('an amount rule cannot claim a credit', () => {
    // 688.76 is the car-loan payment amount; a credit of the same size is not a payment.
    const r = categorize(txn('SOME CREDIT', 688.76, 'income'), CATEGORY_RULES)
    expect(r.txnType).toBe('income')
    expect(categorize(txn('SOME PAYMENT', 688.76), CATEGORY_RULES).txnType).toBe('debt')
  })
})

describe('categorize — incoming wording is recognized without a sign', () => {
  // These make `budget.py --recategorize` able to repair rows already stored with
  // the wrong direction: it only has the cleaned merchant text to work from.
  it.each([
    ['Online Transfer From Chk ...', 'Income', 'income'],
    ['Zelle Payment From Jane Doe', 'Income', 'income'],
    ['Remote Online Deposit', 'Income', 'income'],
    ['American Express Payroll', 'Income', 'income'],
  ])('%s -> %s/%s even when stored as an expense', (desc, cat, type) => {
    const r = categorize(txn(desc, 100, 'expense'), CATEGORY_RULES)
    expect(r.category).toBe(cat)
    expect(r.txnType).toBe(type)
  })

  it('leaves the outgoing side of a transfer alone', () => {
    const r = categorize(txn('Online Transfer To Chk ...5546', 5), CATEGORY_RULES)
    expect(r.txnType).toBe('expense')
    expect(r.category).toBe('Misc')
  })
})

describe('categorize — defaults & ordering', () => {
  it('unknown -> Misc/expense', () => {
    const r = categorize(txn('ZZZUNKNOWNMERCHANT999'), CATEGORY_RULES)
    expect(r.category).toBe('Misc')
    expect(r.txnType).toBe('expense')
  })
  it('first matching rule wins', () => {
    expect(categorize(txn('DOORDASH UBER ORDER'), CATEGORY_RULES).category).toBe('Dining')
  })
})
