// Per-row edits the user makes on the import preview before confirming, applied
// server-side to the freshly re-parsed batch. Two edits are allowed, both keyed
// by a transaction's hash (the stable identity handed to the client):
//   - selection: which rows to actually import (uncheck to skip a row)
//   - txn_type overrides: fix an income/spend (direction) discrepancy on a row
//
// These are pure and deliberately narrow: the server never trusts a client-sent
// amount, date, merchant, or hash. A user can only *narrow* the set and flip a
// direction. The hash does not depend on txn_type, so an override can never
// change which rows are considered duplicates.

import type { ParsedTransaction } from './types'
import type { TxnType } from '@/lib/supabase/types'

export const VALID_TXN_TYPES: readonly TxnType[] = ['expense', 'income', 'investment', 'debt']

export interface ImportEdits {
  /** Hashes to import. `null` means "no selection sent" -> import everything. */
  selected: Set<string> | null
  /** hash -> the txn_type the user picked. Invalid types are dropped. */
  typeOverrides: Map<string, TxnType>
}

export function isTxnType(value: unknown): value is TxnType {
  return typeof value === 'string' && (VALID_TXN_TYPES as readonly string[]).includes(value)
}

/** Parse `{ [hash]: txnType }` (from JSON), keeping only valid txn types. */
export function parseTypeOverrides(raw: unknown): Map<string, TxnType> {
  const out = new Map<string, TxnType>()
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [hash, type] of Object.entries(raw as Record<string, unknown>)) {
      if (isTxnType(type)) out.set(hash, type)
    }
  }
  return out
}

/** Parse a list of selected hashes (from JSON). Anything else -> `null`. */
export function parseSelectedHashes(raw: unknown): Set<string> | null {
  if (Array.isArray(raw)) return new Set(raw.map(String))
  return null
}

/**
 * Apply the user's edits to the new-transaction set: flip each row's txn_type to
 * the chosen override, then drop the rows they unchecked. Returns a new array
 * (with the overridden `txnType`) and never mutates the inputs.
 */
export function applyEdits(newTxns: ParsedTransaction[], edits: ImportEdits): ParsedTransaction[] {
  const { selected, typeOverrides } = edits
  const out: ParsedTransaction[] = []
  for (const t of newTxns) {
    if (selected && !selected.has(t.hash)) continue
    const override = typeOverrides.get(t.hash)
    out.push(override && override !== t.txnType ? { ...t, txnType: override } : t)
  }
  return out
}
