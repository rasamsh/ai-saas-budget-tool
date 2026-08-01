// CSV reading via papaparse (handles quoting, embedded commas, BOM) — the
// equivalent of Python's csv.DictReader used across the parsers.

import Papa from 'papaparse'
import type { CsvRow } from './types'

export interface ParsedCsv {
  fields: string[]
  rows: CsvRow[]
}

/** Parse CSV text with a header row into { fields, rows } of string values. */
export function readCsv(text: string): ParsedCsv {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
  })
  const fields = result.meta.fields ?? []
  return { fields, rows: result.data }
}

/** Parse an amount string like "1,234.56" or "$50.00"; 0 if empty/invalid. */
export function parseAmount(value: string | undefined): number {
  const val = (value ?? '').trim().replace(/,/g, '').replace(/\$/g, '')
  if (!val) return 0
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}
