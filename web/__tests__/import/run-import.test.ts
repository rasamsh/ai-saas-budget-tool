import { describe, it, expect } from 'vitest'
import { processFile, processFiles } from '@/lib/import/run-import'

const CHASE_CHECKING = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,06/15/2026,WHOLE FOODS MARKET,-120.00,DEBIT_CARD,1000.00,
DEBIT,06/16/2026,AMERICAN EXPRESS ACH PMT,-500.00,ACH_DEBIT,500.00,
DEBIT,06/17/2026,CHASE CREDIT CRD AUTOPAY,-300.00,ACH_DEBIT,200.00,`

const CHASE_PRIME = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
06/15/2026,06/16/2026,SOME RANDOM STORE 999,Shopping,Sale,-49.99,
06/14/2026,06/15/2026,ANOTHER STORE,Shopping,Sale,-9.99,`

const AMEX_SHORT = `Date,Description,Amount
06/15/2026,STARBUCKS STORE 123,6.50
06/14/2026,WHOLE FOODS MARKET,89.20`

describe('processFile — manifest semantics by account label', () => {
  it('applies exclude patterns for Chase Checking (autopay double-count guard)', () => {
    const result = processFile({
      filename: 'renamed_download.csv', // filename does NOT match manifest glob
      text: CHASE_CHECKING,
      bank: 'chase',
      account: 'Chase Checking',
    })
    // AMERICAN EXPRESS + CHASE CREDIT CRD lines excluded; WHOLE FOODS remains.
    expect(result.parsed).toBe(1)
    expect(result.excluded).toBe(2)
    expect(result.transactions[0].merchant).toContain('Whole Foods')
  })

  it('applies override merchant for Chase Prime', () => {
    const result = processFile({
      filename: 'x.csv',
      text: CHASE_PRIME,
      bank: 'chase',
      account: 'Chase Prime',
    })
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions.every(t => t.merchant === 'Amazon')).toBe(true)
  })

  it('assigns hash and category to every transaction', () => {
    const result = processFile({ filename: 'a.csv', text: AMEX_SHORT, bank: 'amex', account: 'Amex Blue' })
    for (const t of result.transactions) {
      expect(t.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(t.category).toBeTruthy()
    }
  })
})

// A real Chase checking export: money out, money in, and an internal transfer
// in both directions. The credits are what the categorizer used to get wrong.
const CHASE_CHECKING_CREDITS = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
CREDIT,07/22/2026,"Online Transfer From Chk ...5546 transaction#: 29871676506 07/22",3900.00,ACCT_XFER,9096.80,,
CREDIT,07/01/2026,"Zelle payment from JAYADEEP KANDAGATLA 29826021369",15.00,QUICKPAY_CREDIT,6971.54,,
CREDIT,06/30/2026,"American Express PAYROLL                    PPD ID: 1133133497",3740.81,ACH_CREDIT,6964.51,,
DEBIT,07/03/2026,"Online Transfer to CHK ...5546 transaction#: 29871676506 07/03",-5.00,ACCT_XFER,6471.78,,
DEBIT,07/08/2026,"CHASE CREDIT CRD AUTOPAY                    PPD ID: 4760039224",-117.86,ACH_DEBIT,5196.80,,`

describe('processFile — Chase checking credits', () => {
  const result = processFile({
    filename: 'chase_checking_july.csv',
    text: CHASE_CHECKING_CREDITS,
    bank: 'chase',
    account: 'Chase Checking',
  })
  const byDate = (d: string) => result.transactions.find(t => t.date === d)!

  it('records an incoming transfer as income, not a Misc expense', () => {
    const txn = byDate('2026-07-22')
    expect(txn.amount).toBe(3900)
    expect(txn.txnType).toBe('income')
    expect(txn.category).toBe('Income')
  })

  it('records an incoming Zelle payment as income', () => {
    expect(byDate('2026-07-01').txnType).toBe('income')
  })

  it('keeps a payroll deposit that shares a payee name with an excluded card autopay', () => {
    // "AMERICAN EXPRESS" is an exclude pattern for this account (Amex autopay is
    // tracked from the Amex statement) — it must not swallow an Amex payroll deposit.
    const payroll = byDate('2026-06-30')
    expect(payroll).toBeDefined()
    expect(payroll.txnType).toBe('income')
    expect(payroll.amount).toBe(3740.81)
  })

  it('still excludes the card autopay debit', () => {
    expect(byDate('2026-07-08')).toBeUndefined()
    expect(result.excluded).toBe(1)
  })

  it('leaves the outgoing side of a transfer as an expense', () => {
    expect(byDate('2026-07-03').txnType).toBe('expense')
  })

  it('never emits a credit typed as money out', () => {
    const moneyOut = new Set(['expense', 'debt', 'investment'])
    const credits = result.transactions.filter(t => t.category === 'Income')
    expect(credits.length).toBeGreaterThan(0)
    expect(credits.every(t => !moneyOut.has(t.txnType))).toBe(true)
  })
})

describe('processFiles — batch dedupe', () => {
  it('collapses identical rows across files', () => {
    const file = { filename: 'amex.csv', text: AMEX_SHORT, bank: 'amex' as const, account: 'Amex Blue' }
    const result = processFiles([file, { ...file, filename: 'amex-copy.csv' }])
    // Each file has 2 txns; identical hashes collapse to 2 unique.
    expect(result.transactions).toHaveLength(2)
    expect(result.collapsed).toBe(2)
  })

  it('keeps distinct transactions from different files', () => {
    const result = processFiles([
      { filename: 'a.csv', text: AMEX_SHORT, bank: 'amex', account: 'Amex Blue' },
      { filename: 'b.csv', text: CHASE_PRIME, bank: 'chase', account: 'Chase Prime' },
    ])
    expect(result.transactions.length).toBe(4)
    expect(result.collapsed).toBe(0)
  })
})
