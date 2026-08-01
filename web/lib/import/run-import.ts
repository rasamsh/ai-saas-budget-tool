// Pure orchestration of the import pipeline — no Supabase, no I/O beyond the
// text it is handed. Mirrors budget.py::_process_file_entry per file:
//   parse -> exclude filter -> refund netting -> override merchant
//   -> hash (raw description) -> categorize -> scrub.
// Then dedupes across the whole batch by hash (identical rows collapse, exactly
// as the DB's UNIQUE(user_id, hash) constraint would).

import type { Bank, CategoryRules, ParsedTransaction } from './types'
import { computeHash } from './hash'
import { categorize } from './categorizer'
import { scrub } from './scrubber'
import { netRefunds } from './netting'
import { ruleForAccount } from './manifest'
import { CATEGORY_RULES } from './rules'
import * as chase from './parsers/chase'
import * as amex from './parsers/amex'
import * as citi from './parsers/citi'
import * as bofa from './parsers/bofa'

const PARSERS: Record<Bank, { parse: typeof chase.parse; parseRefunds: typeof chase.parseRefunds }> = {
  chase,
  amex,
  citi,
  bofa,
}

export interface FileInput {
  filename: string
  text: string
  bank: Bank
  account: string
}

export interface FileResult {
  filename: string
  account: string
  bank: Bank
  parsed: number
  excluded: number
  transactions: ParsedTransaction[]
}

export interface ProcessResult {
  files: FileResult[]
  /** Unique transactions across the batch (first occurrence of each hash). */
  transactions: ParsedTransaction[]
  /** How many identical-hash rows were collapsed across the batch. */
  collapsed: number
}

export interface ProcessOptions {
  achNames?: string[]
  rules?: CategoryRules
}

/**
 * Drop rows matching the account's exclude patterns.
 *
 * Exclusions exist to avoid double-counting money going out (card autopay that is
 * already tracked from the card's own statement), so they only apply to debits.
 * A credit is never a duplicate of a card charge, and matching one on payee name
 * alone silently deletes income - e.g. "AMERICAN EXPRESS" excludes the Amex autopay
 * debit, but must not also exclude an "American Express PAYROLL" deposit.
 */
function applyExclude(txns: ParsedTransaction[], patterns: string[]): ParsedTransaction[] {
  if (!patterns.length) return txns
  const upper = patterns.map(p => p.toUpperCase())
  return txns.filter(t => {
    if (t.txnType === 'income') return true
    const d = t.description.toUpperCase()
    return !upper.some(p => d.includes(p))
  })
}

/** Process one file into its final transaction list (no batch dedup yet). */
export function processFile(input: FileInput, options: ProcessOptions = {}): FileResult {
  const { filename, text, bank, account } = input
  const rules = options.rules ?? CATEGORY_RULES
  const achNames = options.achNames ?? []
  const parser = PARSERS[bank]

  const rule = ruleForAccount(account)
  const excludePatterns = rule?.excludePatterns ?? []
  const overrideMerchant = rule?.overrideMerchant

  let txns = parser.parse(text, account)
  let refunds = parser.parseRefunds(text, account)
  const parsedBeforeExclude = txns.length

  // Exclude patterns (both lists)
  txns = applyExclude(txns, excludePatterns)
  refunds = applyExclude(refunds, excludePatterns)
  const excluded = parsedBeforeExclude - txns.length

  // Refund netting
  if (refunds.length) {
    txns = netRefunds(txns, refunds)
  }

  // Override merchant
  if (overrideMerchant) {
    for (const t of txns) t.merchant = overrideMerchant
  }

  // Hash (from RAW description — before any scrub), then categorize, then scrub
  for (const t of txns) {
    t.hash = computeHash(t.date, t.amount, t.description, t.account)
    categorize(t, rules)
    if (!overrideMerchant) {
      t.merchant = scrub(t.merchant, t.description, achNames)
    }
  }

  return { filename, account, bank, parsed: txns.length, excluded, transactions: txns }
}

/** Process all files and dedupe across the batch by hash. */
export function processFiles(inputs: FileInput[], options: ProcessOptions = {}): ProcessResult {
  const files = inputs.map(f => processFile(f, options))

  const seen = new Set<string>()
  const unique: ParsedTransaction[] = []
  let collapsed = 0
  for (const file of files) {
    for (const t of file.transactions) {
      if (seen.has(t.hash)) {
        collapsed++
        continue
      }
      seen.add(t.hash)
      unique.push(t)
    }
  }

  return { files, transactions: unique, collapsed }
}
