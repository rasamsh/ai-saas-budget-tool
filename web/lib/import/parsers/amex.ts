// TS port of budget-pipeline/parsers/amex.py.
// Amex exports charges as POSITIVE; credits/refunds are NEGATIVE.
// Card Member and Account # columns are dropped (PII).

import type { ParsedTransaction } from '../types'
import { readCsv } from '../csv'
import { parseDateISO } from '../date'
import { makeTxn } from './shared'

type AmexFormat = 'short' | 'full'

export function detectFormat(fields: string[]): AmexFormat {
  return fields.filter(f => f.trim()).length >= 5 ? 'full' : 'short'
}

function collect(text: string, account: string, wantCharges: boolean): ParsedTransaction[] {
  const { rows } = readCsv(text)
  const out: ParsedTransaction[] = []

  for (const row of rows) {
    const rawDesc = (row['Description'] ?? '').trim()
    if (!rawDesc) continue

    const amountStr = (row['Amount'] ?? '').trim()
    if (amountStr === '') continue
    const amount = Number(amountStr.replace(/,/g, ''))
    if (!Number.isFinite(amount)) continue

    const date = parseDateISO(row['Date'])
    if (!date) continue

    if (wantCharges && amount > 0) {
      out.push(makeTxn({ date, description: rawDesc, amount, account, bank: 'amex' }))
    } else if (!wantCharges && amount < 0) {
      out.push(makeTxn({ date, description: rawDesc, amount: Math.abs(amount), account, bank: 'amex' }))
    }
  }

  return out
}

export function parse(text: string, account: string): ParsedTransaction[] {
  return collect(text, account, true)
}

export function parseRefunds(text: string, account: string): ParsedTransaction[] {
  return collect(text, account, false)
}
