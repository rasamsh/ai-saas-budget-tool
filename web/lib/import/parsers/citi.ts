// TS port of budget-pipeline/parsers/citi.py.
// Headers: Status, Date, Description, Debit, Credit, Member Name
// Debit populated = charge; Credit populated = refund. Member Name dropped (PII).

import type { ParsedTransaction } from '../types'
import { readCsv, parseAmount } from '../csv'
import { parseDateISO } from '../date'
import { makeTxn } from './shared'

function collect(text: string, account: string, col: 'Debit' | 'Credit'): ParsedTransaction[] {
  const { rows } = readCsv(text)
  const out: ParsedTransaction[] = []

  for (const row of rows) {
    const rawDesc = (row['Description'] ?? '').trim()
    if (!rawDesc) continue

    const date = parseDateISO(row['Date'])
    if (!date) continue

    const amount = parseAmount(row[col])
    if (amount > 0) {
      out.push(makeTxn({ date, description: rawDesc, amount, account, bank: 'citi' }))
    }
  }

  return out
}

export function parse(text: string, account: string): ParsedTransaction[] {
  return collect(text, account, 'Debit')
}

export function parseRefunds(text: string, account: string): ParsedTransaction[] {
  return collect(text, account, 'Credit')
}
