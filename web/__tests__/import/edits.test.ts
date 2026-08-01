import { describe, it, expect } from 'vitest'
import {
  applyEdits,
  isTxnType,
  parseSelectedHashes,
  parseTypeOverrides,
} from '@/lib/import/edits'
import type { ParsedTransaction } from '@/lib/import/types'
import type { TxnType } from '@/lib/supabase/types'

function txn(hash: string, txnType: TxnType = 'income'): ParsedTransaction {
  return {
    date: '2026-07-22',
    description: `RAW ${hash}`,
    merchant: `Merchant ${hash}`,
    amount: 100,
    account: 'Chase Checking',
    bank: 'chase',
    category: txnType === 'income' ? 'Income' : 'Misc',
    txnType,
    hash,
  }
}

describe('isTxnType', () => {
  it('accepts the four valid txn types', () => {
    for (const t of ['expense', 'income', 'investment', 'debt']) {
      expect(isTxnType(t)).toBe(true)
    }
  })

  it('rejects anything else', () => {
    expect(isTxnType('transfer')).toBe(false)
    expect(isTxnType('')).toBe(false)
    expect(isTxnType(null)).toBe(false)
    expect(isTxnType(undefined)).toBe(false)
    expect(isTxnType(1)).toBe(false)
  })
})

describe('parseTypeOverrides', () => {
  it('keeps only valid txn types', () => {
    const map = parseTypeOverrides({ a: 'expense', b: 'income', c: 'bogus' })
    expect(map.get('a')).toBe('expense')
    expect(map.get('b')).toBe('income')
    expect(map.has('c')).toBe(false)
    expect(map.size).toBe(2)
  })

  it('returns an empty map for non-object / array / null input', () => {
    expect(parseTypeOverrides(null).size).toBe(0)
    expect(parseTypeOverrides(undefined).size).toBe(0)
    expect(parseTypeOverrides(['expense']).size).toBe(0)
    expect(parseTypeOverrides('expense').size).toBe(0)
  })
})

describe('parseSelectedHashes', () => {
  it('parses an array into a set of strings', () => {
    const set = parseSelectedHashes(['a', 'b', 'a'])
    expect(set).toEqual(new Set(['a', 'b']))
  })

  it('returns null (meaning "import everything") for non-array input', () => {
    expect(parseSelectedHashes(undefined)).toBeNull()
    expect(parseSelectedHashes(null)).toBeNull()
    expect(parseSelectedHashes({ a: true })).toBeNull()
  })
})

describe('applyEdits', () => {
  const batch = [txn('a', 'income'), txn('b', 'expense'), txn('c', 'income')]

  it('imports everything untouched when there are no edits', () => {
    const out = applyEdits(batch, { selected: null, typeOverrides: new Map() })
    expect(out).toEqual(batch)
    // Returns the same references when nothing changed.
    expect(out[0]).toBe(batch[0])
  })

  it('drops rows the user unchecked (selection filter)', () => {
    const out = applyEdits(batch, {
      selected: new Set(['a', 'c']),
      typeOverrides: new Map(),
    })
    expect(out.map(t => t.hash)).toEqual(['a', 'c'])
  })

  it('flips txn_type for an overridden row without touching its hash or fields', () => {
    const out = applyEdits(batch, {
      selected: null,
      typeOverrides: new Map([['a', 'expense' as TxnType]]),
    })
    const a = out.find(t => t.hash === 'a')!
    expect(a.txnType).toBe('expense')
    expect(a.hash).toBe('a')
    expect(a.amount).toBe(100)
    expect(a.description).toBe('RAW a')
    // Other rows are unchanged and keep their original reference.
    expect(out.find(t => t.hash === 'b')).toBe(batch[1])
  })

  it('does not mutate the input transactions', () => {
    applyEdits(batch, {
      selected: new Set(['a']),
      typeOverrides: new Map([['a', 'debt' as TxnType]]),
    })
    expect(batch[0].txnType).toBe('income')
  })

  it('applies selection and overrides together', () => {
    const out = applyEdits(batch, {
      selected: new Set(['b', 'c']),
      typeOverrides: new Map([['c', 'expense' as TxnType]]),
    })
    expect(out.map(t => [t.hash, t.txnType])).toEqual([
      ['b', 'expense'],
      ['c', 'expense'],
    ])
  })

  it('returns an empty list when nothing is selected', () => {
    const out = applyEdits(batch, { selected: new Set(), typeOverrides: new Map() })
    expect(out).toEqual([])
  })

  it('ignores an override for a row that is not in the batch', () => {
    const out = applyEdits(batch, {
      selected: null,
      typeOverrides: new Map([['zzz', 'expense' as TxnType]]),
    })
    expect(out).toEqual(batch)
  })
})
