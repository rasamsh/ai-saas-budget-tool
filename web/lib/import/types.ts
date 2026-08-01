// Shared types for the CSV import pipeline (TS port of budget-pipeline).

import type { TxnType } from '@/lib/supabase/types'

export type Bank = 'chase' | 'amex' | 'citi' | 'bofa'

/**
 * One parsed transaction. Mirrors budget-pipeline/parsers/transaction.py.
 * `amount` is ALWAYS positive; sign is conveyed by `txnType`.
 * `date` is an ISO `YYYY-MM-DD` string (Python `str(date)`).
 */
export interface ParsedTransaction {
  date: string        // ISO YYYY-MM-DD
  description: string  // raw bank description (pre-scrub) — used for hashing
  merchant: string     // cleaned merchant name
  amount: number       // always positive
  account: string      // human label, e.g. "Chase Checking"
  bank: Bank
  category: string
  txnType: TxnType
  hash: string
}

/** A bank parser returns expenses/debits and refunds/credits separately. */
export interface BankParser {
  parse(rows: CsvRow[], account: string): ParsedTransaction[]
  parseRefunds(rows: CsvRow[], account: string): ParsedTransaction[]
}

export type CsvRow = Record<string, string>

/** Category rules ported from config/categories.yaml. */
export interface CategoryDef {
  name: string
  txn_type: TxnType
  color: string
}

export interface PatternRule {
  pattern: string
  category: string
  type?: TxnType
}

export interface AmountRule {
  amount: number
  category: string
  type?: TxnType
}

export interface CategoryRules {
  categories: CategoryDef[]
  rules: PatternRule[]
  amount_rules: AmountRule[]
  income_patterns: string[]
}
