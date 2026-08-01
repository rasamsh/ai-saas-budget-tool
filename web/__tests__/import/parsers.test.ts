import { describe, it, expect } from 'vitest'
import * as chase from '@/lib/import/parsers/chase'
import * as amex from '@/lib/import/parsers/amex'
import * as citi from '@/lib/import/parsers/citi'
import * as bofa from '@/lib/import/parsers/bofa'

// Ported from budget-pipeline/tests/test_parsers.py (in-memory CSV text).

const CHASE_CREDIT = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
06/15/2026,06/16/2026,STARBUCKS STORE 123,Food & Drink,Sale,-6.50,
06/14/2026,06/15/2026,AMAZON MKTPL*1P66J2KP3,Shopping,Sale,-49.99,
06/13/2026,06/14/2026,PAYMENT THANK YOU,Payment,Payment,200.00,`

const CHASE_CHECKING = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,06/15/2026,GROCERY STORE,-120.00,ACH_DEBIT,1000.00,
CREDIT,06/01/2026,PAYROLL DIRECT DEPOSIT,4000.00,ACH_CREDIT,5000.00,
DEBIT,06/14/2026,STARBUCKS,-6.50,DEBIT_CARD,880.00,`

describe('Chase credit', () => {
  it('parses expenses only, positive amounts', () => {
    const txns = chase.parse(CHASE_CREDIT, 'Chase Sapphire')
    expect(txns).toHaveLength(2)
    expect(txns.every(t => t.amount > 0)).toBe(true)
    expect(txns.every(t => t.bank === 'chase')).toBe(true)
    expect(txns.every(t => t.account === 'Chase Sapphire')).toBe(true)
  })
  it('excludes payment lines from expenses', () => {
    const txns = chase.parse(CHASE_CREDIT, 'Chase Sapphire')
    expect(txns.some(t => t.merchant.includes('Payment'))).toBe(false)
  })
  it('refunds parsed separately', () => {
    const refunds = chase.parseRefunds(CHASE_CREDIT, 'Chase Sapphire')
    expect(refunds).toHaveLength(1)
    expect(refunds[0].amount).toBe(200)
  })
  it('date parsed to ISO', () => {
    const txns = chase.parse(CHASE_CREDIT, 'Chase Sapphire')
    expect(txns.map(t => t.date)).toContain('2026-06-15')
  })
  it('detects credit format', () => {
    expect(chase.detectFormat(['Transaction Date', 'Post Date', 'Description'])).toBe('credit')
  })
  it('skips rows with missing description', () => {
    const csv = 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n06/15/2026,06/16/2026,,Food,Sale,-6.50,\n'
    expect(chase.parse(csv, 'Chase Sapphire')).toHaveLength(0)
  })
})

describe('Chase checking', () => {
  it('returns debits and credits', () => {
    const txns = chase.parse(CHASE_CHECKING, 'Chase Checking')
    expect(txns).toHaveLength(3)
    expect(txns.filter(t => t.txnType === 'expense')).toHaveLength(2)
    expect(txns.filter(t => t.txnType === 'income')).toHaveLength(1)
    expect(txns.every(t => t.amount > 0)).toBe(true)
  })
  it('parseRefunds returns empty for checking', () => {
    expect(chase.parseRefunds(CHASE_CHECKING, 'Chase Checking')).toEqual([])
  })
  it('detects checking format', () => {
    expect(chase.detectFormat(['Details', 'Posting Date', 'Description', 'Amount'])).toBe('checking')
  })
})

const AMEX_SHORT = `Date,Description,Amount
06/15/2026,STARBUCKS STORE 123,6.50
06/14/2026,WHOLE FOODS MARKET,89.20
06/13/2026,REFUND FROM AMAZON,-25.00`

const AMEX_FULL = `Date,Description,Card Member,Account #,Amount
06/15/2026,NETFLIX.COM,JOHN DOE,1234,15.99
06/14/2026,DELTA AIRLINES,JOHN DOE,1234,320.00
06/13/2026,CREDIT ADJUSTMENT,JOHN DOE,1234,-50.00`

describe('Amex', () => {
  it('short: parses charges, excludes credits', () => {
    const txns = amex.parse(AMEX_SHORT, 'Amex Blue')
    expect(txns).toHaveLength(2)
    expect(txns.every(t => t.amount > 0 && t.bank === 'amex')).toBe(true)
  })
  it('short: refunds are negative amounts stored positive', () => {
    const refunds = amex.parseRefunds(AMEX_SHORT, 'Amex Blue')
    expect(refunds).toHaveLength(1)
    expect(refunds[0].amount).toBe(25)
  })
  it('full: parses charges without leaking PII', () => {
    const txns = amex.parse(AMEX_FULL, 'Amex Platinum')
    expect(txns).toHaveLength(2)
    for (const t of txns) {
      expect(t.merchant).not.toContain('JOHN DOE')
      expect(t.account).toBe('Amex Platinum')
    }
  })
  it('detects formats by column count', () => {
    expect(amex.detectFormat(['Date', 'Description', 'Amount'])).toBe('short')
    expect(amex.detectFormat(['Date', 'Description', 'Card Member', 'Account #', 'Amount'])).toBe('full')
  })
})

const CITI = `Status,Date,Description,Debit,Credit,Member Name
Cleared,06/15/2026,STARBUCKS STORE 123,6.50,,JOHN DOE
Cleared,06/14/2026,WHOLE FOODS MARKET,120.00,,JOHN DOE
Cleared,06/13/2026,CREDIT FROM MERCHANT,,50.00,JOHN DOE
Cleared,06/12/2026,INVALID ROW,,0.00,JOHN DOE`

describe('Citi', () => {
  it('parses debits, positive, no PII', () => {
    const txns = citi.parse(CITI, 'Citi Custom Cash')
    expect(txns).toHaveLength(2)
    expect(txns.every(t => t.amount > 0 && t.bank === 'citi')).toBe(true)
    for (const t of txns) expect(t.merchant).not.toContain('JOHN DOE')
  })
  it('credits in refunds, zero excluded', () => {
    const refunds = citi.parseRefunds(CITI, 'Citi Custom Cash')
    expect(refunds).toHaveLength(1)
    expect(refunds[0].amount).toBe(50)
  })
  it('skips empty description', () => {
    const csv = 'Status,Date,Description,Debit,Credit,Member Name\nCleared,06/15/2026,,6.50,,JOHN DOE\n'
    expect(citi.parse(csv, 'Citi')).toHaveLength(0)
  })
})

const BOFA_CREDIT = `Description : Some Account Preamble
Posted Date,Reference Number,Payee,Address,Amount
06/15/2026,0001,STARBUCKS STORE 123,SEATTLE WA,-6.50
06/14/2026,0002,PAYMENT - THANK YOU,,120.00`

const BOFA_CHECKING = `Summary line ignored
Description,,Summary Amt.
Date,Description,Amount,Running Bal.
06/15/2026,GROCERY STORE,-120.00,1000.00
06/01/2026,PAYROLL DEPOSIT,4000.00,5000.00`

describe('BofA', () => {
  it('credit: charges positive, refunds separate, skips preamble', () => {
    const txns = bofa.parse(BOFA_CREDIT, 'BofA Cash')
    expect(txns).toHaveLength(1)
    expect(txns[0].amount).toBe(6.5)
    const refunds = bofa.parseRefunds(BOFA_CREDIT, 'BofA Cash')
    expect(refunds).toHaveLength(1)
    expect(refunds[0].amount).toBe(120)
  })
  it('checking: debit expense + credit income, no separate refunds', () => {
    const txns = bofa.parse(BOFA_CHECKING, 'BofA Checking')
    expect(txns).toHaveLength(2)
    expect(txns.filter(t => t.txnType === 'income')).toHaveLength(1)
    expect(bofa.parseRefunds(BOFA_CHECKING, 'BofA Checking')).toEqual([])
  })
})
