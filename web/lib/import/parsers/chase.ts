// TS port of budget-pipeline/parsers/chase.py — credit + checking formats.

import type { ParsedTransaction } from '../types'
import { readCsv } from '../csv'
import { parseDateISO } from '../date'
import { makeTxn } from './shared'

type ChaseFormat = 'credit' | 'checking'

export function detectFormat(fields: string[]): ChaseFormat {
  const lower = fields.map(f => f.trim().toLowerCase())
  if (lower.includes('transaction date')) return 'credit'
  if (lower.includes('details') && lower.includes('posting date')) return 'checking'
  return 'credit'
}

interface Split {
  fmt: ChaseFormat
  expenses: ParsedTransaction[]
  refunds: ParsedTransaction[]
}

function parseAll(text: string, account: string): Split {
  const { fields, rows } = readCsv(text)
  const fmt = detectFormat(fields)
  const expenses: ParsedTransaction[] = []
  const refunds: ParsedTransaction[] = []
  const dateCol = fmt === 'credit' ? 'Transaction Date' : 'Posting Date'

  for (const row of rows) {
    const rawDesc = (row['Description'] ?? '').trim()
    if (!rawDesc) continue

    const amountStr = (row['Amount'] ?? '').trim()
    if (amountStr === '') continue
    const amount = Number(amountStr.replace(/,/g, ''))
    if (!Number.isFinite(amount)) continue

    const date = parseDateISO(row[dateCol])
    if (!date) continue

    if (amount < 0) {
      expenses.push(makeTxn({ date, description: rawDesc, amount: Math.abs(amount), account, bank: 'chase' }))
    } else if (amount > 0) {
      if (fmt === 'credit') {
        // Payment/credit -> refund bucket (as an expense-typed txn for netting)
        refunds.push(makeTxn({ date, description: rawDesc, amount, account, bank: 'chase' }))
      } else {
        // Checking credit -> income initially; categorizer may reclassify
        refunds.push(
          makeTxn({ date, description: rawDesc, amount, account, bank: 'chase', category: 'Income', txnType: 'income' }),
        )
      }
    }
  }

  return { fmt, expenses, refunds }
}

export function parse(text: string, account: string): ParsedTransaction[] {
  const { fmt, expenses, refunds } = parseAll(text, account)
  // Credit: charges only. Checking: debits + credits (income) both returned.
  return fmt === 'credit' ? expenses : [...expenses, ...refunds]
}

export function parseRefunds(text: string, account: string): ParsedTransaction[] {
  const { fmt, refunds } = parseAll(text, account)
  // Checking credits are already returned by parse(); no separate refunds.
  return fmt === 'credit' ? refunds : []
}
