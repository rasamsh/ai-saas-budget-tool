'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Bank, ParsedTransaction } from '@/lib/import/types'
import type { TxnType } from '@/lib/supabase/types'
import { processFiles, type FileInput } from '@/lib/import/run-import'
import { unrecognizedIncomeWarnings } from '@/lib/import/warnings'
import {
  applyEdits,
  parseSelectedHashes,
  parseTypeOverrides,
  type ImportEdits,
} from '@/lib/import/edits'

// Upload limits (see CLAUDE.md -> in-app import). Sized to work on a ~4.5MB
// serverless body cap; real bank CSVs are 10-200 KB.
const MAX_FILES = 12
const MAX_FILE_BYTES = 1 * 1024 * 1024
const MAX_TOTAL_BYTES = 4 * 1024 * 1024
const HASH_CHUNK = 100
const INSERT_CHUNK = 500
const VALID_BANKS: Bank[] = ['chase', 'amex', 'citi', 'bofa']

export interface PreviewFile {
  filename: string
  account: string
  bank: Bank
  parsed: number
  excluded: number
}

export interface SampleTxn {
  hash: string
  date: string
  merchant: string
  amount: number
  category: string
  txnType: TxnType
  account: string
}

export interface PreviewResult {
  ok: boolean
  error?: string
  canCommit: boolean
  files: PreviewFile[]
  totalParsed: number
  totalNew: number
  totalDuplicates: number
  collapsed: number
  perAccountNew: { account: string; count: number }[]
  sample: SampleTxn[]
  warnings: string[]
  periodStart: string | null
  periodEnd: string | null
}

export interface CommitResult {
  ok: boolean
  error?: string
  inserted: number
  skipped: number
  batchId: string | null
  periodStart: string | null
  periodEnd: string | null
  message?: string
}

function achNames(): string[] {
  return (process.env.IMPORT_ACH_SCRUB_NAMES ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

/** Read files + per-file {bank, account} meta from FormData into FileInputs. */
async function readFormData(
  formData: FormData,
): Promise<{ inputs?: FileInput[]; error?: string }> {
  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  const metaRaw = formData.get('meta')

  if (!files.length) return { error: 'No files were uploaded.' }
  if (files.length > MAX_FILES) return { error: `Too many files (max ${MAX_FILES}).` }

  let meta: { bank: string; account: string }[]
  try {
    meta = JSON.parse(typeof metaRaw === 'string' ? metaRaw : '[]')
  } catch {
    return { error: 'Malformed upload metadata.' }
  }
  if (!Array.isArray(meta) || meta.length !== files.length) {
    return { error: 'Upload metadata does not match the files.' }
  }

  let total = 0
  const inputs: FileInput[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    total += file.size
    if (file.size > MAX_FILE_BYTES) {
      return { error: `"${file.name}" is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB per file).` }
    }
    if (total > MAX_TOTAL_BYTES) {
      return { error: `Upload exceeds ${MAX_TOTAL_BYTES / 1024 / 1024} MB total.` }
    }

    const { bank, account } = meta[i]
    if (!VALID_BANKS.includes(bank as Bank)) {
      return { error: `"${file.name}": unrecognized bank "${bank}". Pick a bank for the file.` }
    }
    if (!account || !account.trim()) {
      return { error: `"${file.name}": choose an account before importing.` }
    }

    inputs.push({
      filename: file.name,
      text: await file.text(),
      bank: bank as Bank,
      account: account.trim(),
    })
  }

  return { inputs }
}

/** Safely JSON-parse a FormData string field; `undefined` on absent/malformed. */
function readJsonField(formData: FormData, key: string): unknown {
  const raw = formData.get(key)
  if (typeof raw !== 'string' || !raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * The per-row preview edits the user confirmed with: which rows to import and any
 * income/spend (txn_type) fixes. Both are keyed by hash and validated in
 * `lib/import/edits`; the server still re-parses the files, so a client can only
 * narrow the set and flip a direction - never forge amounts, dates, or hashes.
 */
function readEdits(formData: FormData): ImportEdits {
  return {
    selected: parseSelectedHashes(readJsonField(formData, 'selectedHashes')),
    typeOverrides: parseTypeOverrides(readJsonField(formData, 'typeOverrides')),
  }
}

async function fetchKnownCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Set<string>> {
  const { data } = await supabase.from('categories').select('name')
  return new Set((data ?? []).map((c: { name: string }) => c.name))
}

/** Which of these hashes already exist in the DB for this user. */
async function fetchExistingHashes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  hashes: string[],
): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < hashes.length; i += HASH_CHUNK) {
    const chunk = hashes.slice(i, i + HASH_CHUNK)
    const { data, error } = await supabase
      .from('transactions')
      .select('hash')
      .eq('user_id', userId)
      .in('hash', chunk)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) found.add((row as { hash: string }).hash)
  }
  return found
}

function categoryWarnings(transactions: ParsedTransaction[], known: Set<string>): string[] {
  const unknown = [...new Set(transactions.map(t => t.category).filter(c => !known.has(c)))]
  if (!unknown.length) return []
  return [
    `These categories are produced by the rules but not defined in the database: ` +
      `${unknown.join(', ')}. They must be added before importing.`,
  ]
}

function period(transactions: ParsedTransaction[]): [string | null, string | null] {
  if (!transactions.length) return [null, null]
  const dates = transactions.map(t => t.date).sort()
  return [dates[0], dates[dates.length - 1]]
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  const empty: PreviewResult = {
    ok: false,
    canCommit: false,
    files: [],
    totalParsed: 0,
    totalNew: 0,
    totalDuplicates: 0,
    collapsed: 0,
    perAccountNew: [],
    sample: [],
    warnings: [],
    periodStart: null,
    periodEnd: null,
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ...empty, error: 'Not authenticated.' }

  const { inputs, error } = await readFormData(formData)
  if (error || !inputs) return { ...empty, error }

  let processed
  try {
    processed = processFiles(inputs, { achNames: achNames() })
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Failed to process files.' }
  }
  const { files, transactions, collapsed } = processed

  const known = await fetchKnownCategories(supabase)
  // Blocking (the import cannot proceed) vs advisory (shown, but still importable).
  const blocking = categoryWarnings(transactions, known)
  const warnings = [...blocking, ...unrecognizedIncomeWarnings(transactions)]

  let existing: Set<string>
  try {
    existing = await fetchExistingHashes(supabase, user.id, transactions.map(t => t.hash))
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Failed to check for duplicates.' }
  }

  const newTxns = transactions.filter(t => !existing.has(t.hash))
  const totalDuplicates = transactions.length - newTxns.length

  const perAccountMap = new Map<string, number>()
  for (const t of newTxns) perAccountMap.set(t.account, (perAccountMap.get(t.account) ?? 0) + 1)

  const [periodStart, periodEnd] = period(newTxns)

  // Every new transaction is returned (each keyed by its unique hash) so the
  // client can offer a per-row checkbox and an income/spend override before the
  // commit. Hashes are unique within the batch (processFiles collapses dupes).
  const sample: SampleTxn[] = newTxns
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map(t => ({
      hash: t.hash,
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
      txnType: t.txnType,
      account: t.account,
    }))

  return {
    ok: true,
    canCommit: newTxns.length > 0 && blocking.length === 0,
    files: files.map(f => ({
      filename: f.filename,
      account: f.account,
      bank: f.bank,
      parsed: f.parsed,
      excluded: f.excluded,
    })),
    totalParsed: transactions.length + collapsed,
    totalNew: newTxns.length,
    totalDuplicates,
    collapsed,
    perAccountNew: [...perAccountMap.entries()].map(([account, count]) => ({ account, count })),
    sample,
    warnings,
    periodStart,
    periodEnd,
  }
}

function affectedMonths(start: string, end: string): Array<[number, number]> {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  const out: Array<[number, number]> = []
  let y = sy
  let m = sm
  // Guard against malformed input producing an unbounded loop.
  while ((y < ey || (y === ey && m <= em)) && out.length < 600) {
    out.push([y, m])
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

export async function commitImport(formData: FormData): Promise<CommitResult> {
  const fail = (error: string): CommitResult => ({
    ok: false,
    error,
    inserted: 0,
    skipped: 0,
    batchId: null,
    periodStart: null,
    periodEnd: null,
  })

  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
    return fail('Importing is disabled in demo mode.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Not authenticated.')

  const { inputs, error } = await readFormData(formData)
  if (error || !inputs) return fail(error ?? 'Invalid upload.')

  const edits = readEdits(formData)

  let transactions
  try {
    transactions = processFiles(inputs, { achNames: achNames() }).transactions
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to process files.')
  }

  let existing: Set<string>
  try {
    existing = await fetchExistingHashes(supabase, user.id, transactions.map(t => t.hash))
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to check for duplicates.')
  }

  const allNew = transactions.filter(t => !existing.has(t.hash))
  if (allNew.length === 0) {
    return {
      ok: true,
      inserted: 0,
      skipped: transactions.length,
      batchId: null,
      periodStart: null,
      periodEnd: null,
      message: 'Everything in these files was already imported.',
    }
  }

  // Apply the user's per-row income/spend fixes (txn_type only) and drop the rows
  // they unchecked. The hash and every other parsed field is untouched.
  const newTxns = applyEdits(allNew, edits)
  if (newTxns.length === 0) {
    return fail('Select at least one transaction to import.')
  }

  const known = await fetchKnownCategories(supabase)
  // Only blocking warnings stop a commit; unrecognized income is advisory. Check
  // the final selected set so unchecking a bad-category row unblocks the import.
  const blocking = categoryWarnings(newTxns, known)
  if (blocking.length) return fail(blocking[0])

  // 1. Upsert accounts referenced by the new transactions -> id map.
  const accountBank = new Map<string, Bank>()
  for (const t of newTxns) if (!accountBank.has(t.account)) accountBank.set(t.account, t.bank)

  const accountId = new Map<string, string>()
  for (const [name, bank] of accountBank) {
    const { data, error: accErr } = await supabase
      .from('accounts')
      .upsert({ name, bank, user_id: user.id }, { onConflict: 'user_id,name' })
      .select('id, name')
    if (accErr) return fail(`Failed to save account "${name}": ${accErr.message}`)
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.id) return fail(`Could not resolve account "${name}".`)
    accountId.set(name, row.id)
  }

  const [periodStart, periodEnd] = period(newTxns)

  // 2. Insert the batch row first (transactions FK to it), count filled later.
  const { data: batchData, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      period_start: periodStart,
      period_end: periodEnd,
      file_count: accountBank.size,
      transaction_count: 0,
      user_id: user.id,
    })
    .select('id')
  if (batchErr) return fail(`Failed to create import batch: ${batchErr.message}`)
  const batchId = (Array.isArray(batchData) ? batchData[0] : batchData)?.id
  if (!batchId) return fail('Could not create import batch.')

  // 3. Chunked upsert of transactions (ignoreDuplicates backstops races).
  const rows = newTxns.map(t => ({
    date: t.date,
    merchant: t.merchant,
    amount: Math.round(t.amount * 100) / 100,
    category: t.category,
    txn_type: t.txnType,
    account_id: accountId.get(t.account),
    import_batch_id: batchId,
    hash: t.hash,
    user_id: user.id,
  }))

  let inserted = 0
  try {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK)
      const { data, error: insErr } = await supabase
        .from('transactions')
        .upsert(chunk, { onConflict: 'user_id,hash', ignoreDuplicates: true })
        .select('id')
      if (insErr) throw new Error(insErr.message)
      inserted += (data ?? []).length
    }
  } catch (e) {
    // Roll back the orphan batch so the import log never shows an empty entry.
    await supabase.from('import_batches').delete().eq('id', batchId)
    return fail(e instanceof Error ? e.message : 'Failed to insert transactions.')
  }

  // 4. If a concurrent import won every hash, drop the empty batch.
  if (inserted === 0) {
    await supabase.from('import_batches').delete().eq('id', batchId)
    return {
      ok: true,
      inserted: 0,
      skipped: transactions.length,
      batchId: null,
      periodStart: null,
      periodEnd: null,
      message: 'Everything in these files was already imported.',
    }
  }

  // 5. Record the true inserted count on the batch.
  await supabase.from('import_batches').update({ transaction_count: inserted }).eq('id', batchId)

  // 6. Revalidate affected pages.
  const years = new Set<number>()
  if (periodStart && periodEnd) {
    for (const [y, m] of affectedMonths(periodStart, periodEnd)) {
      years.add(y)
      revalidatePath(`/${y}/${String(m).padStart(2, '0')}`)
    }
  }
  for (const y of years) revalidatePath(`/${y}`)
  revalidatePath('/settings/imports')

  return {
    ok: true,
    inserted,
    skipped: transactions.length - inserted,
    batchId,
    periodStart,
    periodEnd,
  }
}
