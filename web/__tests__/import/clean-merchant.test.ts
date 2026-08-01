import { describe, it, expect } from 'vitest'
import { cleanMerchant, pythonTitle } from '@/lib/import/clean-merchant'

// Ported from budget-pipeline/tests/test_categorizer.py (clean_merchant cases).

describe('pythonTitle', () => {
  it('capitalizes each letter-run, digits/hyphens are boundaries', () => {
    expect(pythonTitle('whole foods market')).toBe('Whole Foods Market')
    expect(pythonTitle('chick-fil-a')).toBe('Chick-Fil-A')
    expect(pythonTitle('m1 payments')).toBe('M1 Payments')
    expect(pythonTitle('abc1def')).toBe('Abc1Def')
  })
})

describe('cleanMerchant — Rule 1: trailing state/country code', () => {
  it('strips two-letter state', () => {
    expect(cleanMerchant('STARBUCKS SEATTLE WA')).not.toContain('WA')
  })
  it('strips three-letter code', () => {
    expect(cleanMerchant('SOME MERCHANT USA')).not.toContain('USA')
  })
  it('preserves merchant when no state', () => {
    expect(cleanMerchant('STARBUCKS')).toBe('Starbucks')
  })
})

describe('cleanMerchant — Rule 2: asterisk handling', () => {
  it('keeps real merchant after asterisk', () => {
    expect(cleanMerchant('PAYPAL *HOSTINGER')).toBe('Hostinger')
  })
  it('uses pre-asterisk for reference codes', () => {
    const r = cleanMerchant('AMAZON MKTPL*1P66J2KP3')
    expect(r).toBe('Amazon Mktpl')
    expect(r).not.toContain('1P66')
  })
  it('amzn variant reference code uses pre', () => {
    const r = cleanMerchant('AMZN MKTP US*AB12CD34E')
    expect(r).not.toContain('Ab12')
    expect(r).toContain('Amzn')
  })
  it('multiple asterisks take last; spaced post is a name', () => {
    expect(cleanMerchant('A *B *FINAL PART')).toBe('Final Part')
  })
  it('short post-asterisk code under 6 chars treated as name', () => {
    expect(cleanMerchant('SOME STORE *XYZ')).toBe('Xyz')
  })
})

describe('cleanMerchant — Rules 3-6', () => {
  it('splits on slash', () => {
    expect(cleanMerchant('MERCHANT NAME/EXTRA INFO')).toBe('Merchant Name')
  })
  it('strips AplPay prefix', () => {
    expect(cleanMerchant('AplPay STARBUCKS')).toContain('Starbucks')
    expect(cleanMerchant('APLPAY NETFLIX')).not.toContain('Aplpay')
  })
  it.each(['.COM', '.NET', '.ORG', '.AI', '.IO', '.CO'])('strips TLD %s', tld => {
    expect(cleanMerchant(`NETFLIX${tld}`).toLowerCase()).not.toContain(tld.toLowerCase())
  })
  it('strips 7+ digit strings', () => {
    expect(cleanMerchant('STARBUCKS 1234567')).not.toContain('1234567')
    expect(cleanMerchant('STARBUCKS STORE S1234567')).not.toContain('S1234567')
  })
})

describe('cleanMerchant — Rule 7: title-case, collapse, truncate', () => {
  it('title-cases output', () => {
    expect(cleanMerchant('whole foods market')).toBe('Whole Foods Market')
  })
  it('truncates to 28 chars', () => {
    expect(cleanMerchant('A'.repeat(50)).length).toBeLessThanOrEqual(28)
  })
  it('collapses whitespace', () => {
    expect(cleanMerchant('WHOLE   FOODS   MARKET')).not.toContain('  ')
  })
})

describe('cleanMerchant — real-world', () => {
  it.each([
    ['WHOLE FOODS #123 MOUNTAIN VIEW CA', 'Whole Foods'],
    ['STARBUCKS STORE 123456789 SEATTLE WA', 'Starbucks Store'],
    ['NETFLIX.COM WEB ID: 1234567890', 'Netflix'],
    ['AMAZON MKTPL*1P66J2KP3', 'Amazon Mktpl'],
    ['PAYPAL *HOSTINGER', 'Hostinger'],
  ])('%s -> starts with %s', (desc, prefix) => {
    const r = cleanMerchant(desc)
    expect(r.startsWith(prefix.slice(0, 10))).toBe(true)
    expect(r.length).toBeLessThanOrEqual(28)
  })
})
