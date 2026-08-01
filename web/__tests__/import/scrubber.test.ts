import { describe, it, expect } from 'vitest'
import { scrub } from '@/lib/import/scrubber'

// Ported from budget-pipeline/tests/test_scrubber.py.

const CASES: Array<[string, string, string[], string]> = [
  ['Zelle Payment To John Smith', 'ZELLE PAYMENT TO JOHN SMITH', [], 'Zelle Payment'],
  ['Zelle Payment From Jane Doe', 'ZELLE FROM JANE DOE', [], 'Zelle Payment'],
  ['Sai Rasamalla Ach Orig', 'SAI RASAMALLA ACH ORIG ID: 1234', ['SAI RASAMALLA'], 'ACH Transfer'],
  ['M1 Payments Ppd Id: 8327952000', 'M1 PAYMENTS PPD ID: 8327952000', [], 'M1 Payments'],
  ['Netflix Web Id: 1234567890', 'NETFLIX.COM WEB ID: 1234567890', [], 'Netflix'],
  ['Personal Check', 'CHECK 109', [], 'Personal Check'],
  ['Amazon', 'AMAZON MKTPL*1P66J2KP3', [], 'Amazon'],
  ['Hostinger', 'PAYPAL *HOSTINGER', [], 'Hostinger'],
  ['Whole Foods', 'WHOLE FOODS #123 MOUNTAIN VIEW CA', [], 'Whole Foods'],
  ['Starbucks', 'STARBUCKS STORE 123456789 SEATTLE WA', [], 'Starbucks'],
]

describe('scrub — spec cases', () => {
  it.each(CASES)('%s -> %s', (merchant, desc, names, expected) => {
    expect(scrub(merchant, desc, names)).toBe(expected)
  })
})

describe('scrub — edge cases', () => {
  it('ACH name match is case-insensitive', () => {
    expect(scrub('John Doe Payments', 'JOHN DOE ACH', ['john doe'])).toBe('ACH Transfer')
  })
  it('strips partial account numbers', () => {
    expect(scrub('Chase-71005', 'CHASE DEBIT -71005', [])).not.toContain('-71005')
  })
  it('strips trailing 8+ reference codes', () => {
    expect(scrub('Some Merchant ABCD1234', 'SOME MERCHANT ABCD1234EF', [])).not.toContain('ABCD1234')
  })
  it('output is title-cased', () => {
    const r = scrub('some merchant', 'SOME MERCHANT', [])
    expect(r).toBe('Some Merchant')
  })
  it('truncates to 28 chars', () => {
    expect(scrub('A'.repeat(50), 'A'.repeat(50), []).length).toBeLessThanOrEqual(28)
  })
  it('empty merchant returns empty', () => {
    expect(scrub('', '', [])).toBe('')
  })
  it('matches correct name among many', () => {
    expect(scrub('Jane Smith Transfer', 'JANE SMITH ACH', ['John Doe', 'Jane Smith'])).toBe('ACH Transfer')
  })
  it('WEB ID numeric-only stripped', () => {
    expect(scrub('Hulu Web Id: 9876543210', 'HULU WEB ID: 9876543210', [])).toBe('Hulu')
  })
  it('PPD ID stripped when digits already gone', () => {
    expect(scrub('M1 Payments Ppd Id:', 'M1 PAYMENTS PPD ID: 8327952000', [])).toBe('M1 Payments')
  })
  it('WEB ID stripped when digits already gone', () => {
    const r = scrub('Southwest Gas Billpay Web Id:', 'SOUTHWEST GAS BILLPAY WEB ID: 1234567890', [])
    expect(r).not.toContain('Web Id')
    expect(r).not.toContain(':')
  })
  it('TEL ID stripped', () => {
    const r = scrub('Gilbert Az Utilitie Tel Id:', 'GILBERT AZ UTILITIES TEL ID: 1234567', [])
    expect(r).not.toContain('Tel Id')
    expect(r).not.toContain(':')
  })
  it('empty ach name entries are ignored', () => {
    expect(scrub('Whole Foods', 'WHOLE FOODS MARKET', [''])).toBe('Whole Foods')
  })
  it('masks a Zelle name that only survives in the raw description', () => {
    // Merchant was already name-stripped upstream, but the description still
    // carries the payee — it must not leak through.
    expect(scrub('Zelle', 'ZELLE PAYMENT TO JOHN SMITH', [])).toBe('Zelle Payment')
  })
  it('normalizes a generic Zelle transfer with no payee name', () => {
    expect(scrub('Zelle Transfer', 'ZELLE TRANSFER', [])).toBe('Zelle Payment')
  })
})
