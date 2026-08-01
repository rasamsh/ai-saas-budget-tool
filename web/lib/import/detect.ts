// Bank auto-detection from a CSV's header row. Runs on both client (preview
// hint) and server (authoritative). Scans the first lines so it also finds the
// BofA header that sits below a non-CSV preamble.

import type { Bank } from './types'

const BOFA_CREDIT = ['posted date', 'reference number', 'payee', 'address', 'amount']
const BOFA_CHECKING = ['date', 'description', 'amount', 'running bal.']

function cellsOf(line: string): Set<string> {
  return new Set(
    line.split(',').map(c => c.trim().replace(/^"|"$/g, '').toLowerCase()),
  )
}

function subset(needed: string[], have: Set<string>): boolean {
  return needed.every(n => have.has(n))
}

/**
 * Detect the bank from raw CSV text. Returns null if no signature matches.
 * Order matters: specific signatures are tested before the generic Amex one.
 */
export function detectBank(text: string): Bank | null {
  const lines = text.split(/\r?\n/).slice(0, 20)

  for (const line of lines) {
    if (!line.includes(',')) continue
    const cells = cellsOf(line)

    // Chase — credit ("transaction date") or checking ("details" + "posting date")
    if (cells.has('transaction date')) return 'chase'
    if (cells.has('details') && cells.has('posting date')) return 'chase'

    // Citi — debit/credit split with member name
    if (cells.has('debit') && cells.has('credit') && cells.has('member name')) return 'citi'

    // BofA — credit or checking header sets (below a preamble)
    if (subset(BOFA_CREDIT, cells)) return 'bofa'
    if (subset(BOFA_CHECKING, cells)) return 'bofa'

    // Amex — plain Date/Description/Amount (short or full). Checked last because
    // its signature is the most generic.
    if (cells.has('date') && cells.has('description') && cells.has('amount')) return 'amex'
  }

  return null
}
