import { describe, it, expect } from 'vitest'
import { detectBank } from '@/lib/import/detect'

describe('detectBank', () => {
  it('detects Chase credit', () => {
    expect(detectBank('Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n')).toBe('chase')
  })
  it('detects Chase checking', () => {
    expect(detectBank('Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n')).toBe('chase')
  })
  it('detects Citi', () => {
    expect(detectBank('Status,Date,Description,Debit,Credit,Member Name\n')).toBe('citi')
  })
  it('detects Amex short and full', () => {
    expect(detectBank('Date,Description,Amount\n')).toBe('amex')
    expect(detectBank('Date,Description,Card Member,Account #,Amount\n')).toBe('amex')
  })
  it('detects BofA below a preamble', () => {
    const text = 'Account summary junk\nMore junk\nPosted Date,Reference Number,Payee,Address,Amount\n'
    expect(detectBank(text)).toBe('bofa')
  })
  it('returns null for unrecognized headers', () => {
    expect(detectBank('Foo,Bar,Baz\n1,2,3\n')).toBeNull()
  })
})
