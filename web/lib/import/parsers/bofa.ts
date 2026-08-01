// TS port of budget-pipeline/parsers/bofa.py — credit + checking formats.
// BofA prepends non-CSV preamble lines before the header, so we scan for the
// header row first, then parse from there. Reference Number and Address dropped.

import type { ParsedTransaction } from '../types'
import { readCsv, parseAmount } from '../csv'
import { parseDateISO } from '../date'
import { makeTxn } from './shared'

type BofaFormat = 'credit' | 'checking'

const CREDIT_HEADERS = ['posted date', 'reference number', 'payee', 'address', 'amount']
const CHECKING_HEADERS = ['date', 'description', 'amount', 'running bal.']

function cellsOf(line: string): Set<string> {
  return new Set(line.split(',').map(c => c.trim().replace(/^"|"$/g, '').toLowerCase()))
}

function subset(needed: string[], have: Set<string>): boolean {
  return needed.every(n => have.has(n))
}

interface Located {
  fmt: BofaFormat
  csvText: string
}

/** Find the header line and return the format + CSV text from that line on. */
function locate(text: string): Located {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(',')) continue
    const cells = cellsOf(lines[i])
    if (subset(CREDIT_HEADERS, cells)) return { fmt: 'credit', csvText: lines.slice(i).join('\n') }
    if (subset(CHECKING_HEADERS, cells)) return { fmt: 'checking', csvText: lines.slice(i).join('\n') }
  }
  return { fmt: 'checking', csvText: text } // fallback
}

export function parse(text: string, account: string): ParsedTransaction[] {
  const { fmt, csvText } = locate(text)
  const { rows } = readCsv(csvText)
  const out: ParsedTransaction[] = []

  for (const row of rows) {
    const rawDesc = (fmt === 'credit' ? row['Payee'] : row['Description'])?.trim() ?? ''
    const dateStr = fmt === 'credit' ? row['Posted Date'] : row['Date']
    if (!rawDesc) continue

    const date = parseDateISO(dateStr)
    if (!date) continue

    const amount = parseAmount(row['Amount'])

    if (amount < 0) {
      out.push(makeTxn({ date, description: rawDesc, amount: Math.abs(amount), account, bank: 'bofa' }))
    } else if (amount > 0 && fmt === 'checking') {
      out.push(
        makeTxn({ date, description: rawDesc, amount, account, bank: 'bofa', category: 'Income', txnType: 'income' }),
      )
    }
  }

  return out
}

export function parseRefunds(text: string, account: string): ParsedTransaction[] {
  const { fmt, csvText } = locate(text)
  if (fmt !== 'credit') return []
  const { rows } = readCsv(csvText)
  const out: ParsedTransaction[] = []

  for (const row of rows) {
    const rawDesc = (row['Payee'] ?? '').trim()
    if (!rawDesc) continue

    const date = parseDateISO(row['Posted Date'])
    if (!date) continue

    const amount = parseAmount(row['Amount'])
    if (amount > 0) {
      out.push(makeTxn({ date, description: rawDesc, amount, account, bank: 'bofa' }))
    }
  }

  return out
}
