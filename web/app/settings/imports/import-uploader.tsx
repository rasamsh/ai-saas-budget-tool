'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/pill'
import { Mascot } from '@/components/ui/mascot'
import { cn, TXN_TYPE_COLORS } from '@/lib/utils'
import type { Bank } from '@/lib/import/types'
import type { TxnType } from '@/lib/supabase/types'
import { detectBank } from '@/lib/import/detect'
import { ruleForFilename } from '@/lib/import/manifest'
import {
  previewImport,
  commitImport,
  type PreviewResult,
  type CommitResult,
} from '@/app/actions/import'

const BANKS: Bank[] = ['chase', 'amex', 'citi', 'bofa']
const BANK_LABEL: Record<Bank, string> = {
  chase: 'Chase',
  amex: 'Amex',
  citi: 'Citi',
  bofa: 'Bank of America',
}

interface FileRow {
  id: string
  file: File
  text: string
  bank: Bank | ''
  account: string
  detected: Bank | null
}

const TXN_TYPES: TxnType[] = ['expense', 'income', 'investment', 'debt']
const TXN_TYPE_LABEL: Record<TxnType, string> = {
  expense: 'Spend',
  income: 'Income',
  investment: 'Invest',
  debt: 'Debt',
}

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function ImportUploader({ accounts }: { accounts: { name: string; bank: string }[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const datalistId = useId()

  const [rows, setRows] = useState<FileRow[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)
  // Per-row edits on the preview, keyed by transaction hash: which rows stay
  // checked, and any income/spend (txn_type) fixes the user applied.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [typeOverrides, setTypeOverrides] = useState<Record<string, TxnType>>({})

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null)
      setResult(null)
      setPreview(null)
      const incoming = Array.from(fileList).filter(f => /\.csv$/i.test(f.name))
      const built = await Promise.all(
        incoming.map(async (file): Promise<FileRow> => {
          const text = await file.text()
          const detected = detectBank(text)
          const rule = ruleForFilename(file.name)
          // Prefill account: filename rule -> single existing account for the
          // detected bank -> blank (force explicit choice).
          const bank: Bank | '' = detected ?? rule?.bank ?? ''
          let account = rule?.account ?? ''
          if (!account && bank) {
            const forBank = accounts.filter(a => a.bank === bank)
            if (forBank.length === 1) account = forBank[0].name
          }
          return {
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
            file,
            text,
            bank,
            account,
            detected,
          }
        }),
      )
      setRows(prev => [...prev, ...built])
    },
    [accounts],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  function updateRow(id: string, patch: Partial<FileRow>) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
    setPreview(null)
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    setPreview(null)
  }

  function reset() {
    setRows([])
    setPreview(null)
    setResult(null)
    setError(null)
    setSelected(new Set())
    setTypeOverrides({})
    if (inputRef.current) inputRef.current.value = ''
  }

  function toggleRow(hash: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(hash)) next.delete(hash)
      else next.add(hash)
      return next
    })
  }

  function toggleAll(all: boolean) {
    setSelected(all && preview?.ok ? new Set(preview.sample.map(t => t.hash)) : new Set())
  }

  function setRowType(hash: string, type: TxnType) {
    setTypeOverrides(prev => ({ ...prev, [hash]: type }))
  }

  function buildFormData(withEdits = false): FormData {
    const fd = new FormData()
    const meta = rows.map(r => ({ bank: r.bank, account: r.account }))
    rows.forEach(r => fd.append('file', r.file))
    fd.append('meta', JSON.stringify(meta))
    if (withEdits) {
      fd.append('selectedHashes', JSON.stringify([...selected]))
      fd.append('typeOverrides', JSON.stringify(typeOverrides))
    }
    return fd
  }

  const readyToPreview =
    rows.length > 0 && rows.every(r => r.bank !== '' && r.account.trim() !== '')

  async function onPreview() {
    setBusy(true)
    setError(null)
    try {
      const res = await previewImport(buildFormData())
      if (!res.ok) {
        setError(res.error ?? 'Preview failed.')
      } else {
        setPreview(res)
        // Start with every new row checked and no type edits.
        setSelected(new Set(res.sample.map(t => t.hash)))
        setTypeOverrides({})
      }
    } catch {
      setError('Something went wrong while previewing the import.')
    } finally {
      setBusy(false)
    }
  }

  async function onCommit() {
    setBusy(true)
    setError(null)
    try {
      const res = await commitImport(buildFormData(true))
      if (!res.ok) {
        setError(res.error ?? 'Import failed.')
      } else {
        setResult(res)
        setRows([])
        setPreview(null)
        if (inputRef.current) inputRef.current.value = ''
        router.refresh()
      }
    } catch {
      setError('Something went wrong while importing.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Import transactions</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Drop your bank CSV exports below. We detect the bank, preview what&apos;s new, then upload
          on your confirmation.
        </p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={e => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-[color:var(--accent)] bg-[var(--muted)]'
            : 'border-[var(--border-soft)] hover:bg-[var(--muted)]'
        }`}
      >
        <Mascot size={40} />
        <div className="text-sm font-semibold">Drag &amp; drop CSV files here</div>
        <div className="text-xs text-[var(--muted-foreground)]">or click to browse · .csv only</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.CSV,text/csv"
          className="hidden"
          onChange={e => {
            if (e.target.files?.length) addFiles(e.target.files)
          }}
        />
      </div>

      {/* Per-file rows */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <datalist id={datalistId}>
            {accounts.map(a => (
              <option key={a.name} value={a.name} />
            ))}
          </datalist>

          {rows.map(row => {
            const rule = row.account ? ruleForFilename(row.file.name) : undefined
            return (
              <div
                key={row.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border-2 border-[var(--border-soft)] p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{row.file.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {formatBytes(row.file.size)}
                    {row.detected ? (
                      <> · detected {BANK_LABEL[row.detected]}</>
                    ) : (
                      <span className="text-[color:var(--danger,#dc2626)]"> · bank not recognized</span>
                    )}
                    {rule?.excludePatterns?.length ? <> · autopay exclusions on</> : null}
                    {rule?.overrideMerchant ? <> · merchant → {rule.overrideMerchant}</> : null}
                  </div>
                </div>

                <select
                  value={row.bank}
                  onChange={e => updateRow(row.id, { bank: e.target.value as Bank })}
                  className="rounded-lg border-2 border-[var(--border-soft)] bg-[var(--card)] px-2 py-1.5 text-sm"
                  aria-label="Bank"
                >
                  <option value="">Bank…</option>
                  {BANKS.map(b => (
                    <option key={b} value={b}>
                      {BANK_LABEL[b]}
                    </option>
                  ))}
                </select>

                <input
                  list={datalistId}
                  value={row.account}
                  placeholder="Account…"
                  onChange={e => updateRow(row.id, { account: e.target.value })}
                  className="rounded-lg border-2 border-[var(--border-soft)] bg-[var(--card)] px-2 py-1.5 text-sm sm:w-44"
                  aria-label="Account"
                />

                <button
                  onClick={() => removeRow(row.id)}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors self-end sm:self-auto"
                  aria-label={`Remove ${row.file.name}`}
                >
                  Remove
                </button>
              </div>
            )
          })}

          <div className="flex items-center gap-3">
            <Button onClick={onPreview} disabled={!readyToPreview || busy}>
              {busy && !preview ? 'Checking…' : 'Preview import'}
            </Button>
            <button
              onClick={reset}
              disabled={busy}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border-2 border-[color:var(--danger,#dc2626)] bg-[color:var(--danger,#dc2626)]/5 px-4 py-3 text-sm text-[color:var(--danger,#dc2626)]">
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && preview.ok && (
        <div className="space-y-4 rounded-xl border-2 border-[var(--border-soft)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>
              {preview.totalNew > 0
                ? `${selected.size} of ${preview.totalNew} selected`
                : `${preview.totalNew} new`}
            </Pill>
            <Pill variant="outline">{preview.totalDuplicates} duplicates skipped</Pill>
            {preview.collapsed > 0 && (
              <Pill variant="outline">{preview.collapsed} identical rows collapsed</Pill>
            )}
          </div>

          {preview.perAccountNew.length > 0 && (
            <div className="text-xs text-[var(--muted-foreground)]">
              {preview.perAccountNew.map(a => `${a.account}: ${a.count}`).join(' · ')}
            </div>
          )}

          {preview.warnings.map((w, i) => (
            <div
              key={i}
              className="rounded-lg border-2 border-[color:var(--warning,#d97706)] bg-[color:var(--warning,#d97706)]/5 px-3 py-2 text-xs text-[color:var(--warning,#d97706)]"
            >
              {w}
            </div>
          ))}

          {preview.totalNew > 0 ? (
            <div className="max-h-72 overflow-auto rounded-lg border border-[var(--border-soft)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--card)]">
                  <tr className="border-b border-[var(--border-soft)] text-left">
                    <th className="px-3 py-2 w-9">
                      <input
                        type="checkbox"
                        className="align-middle accent-[color:var(--accent)]"
                        aria-label="Select all transactions"
                        checked={selected.size === preview.sample.length}
                        ref={el => {
                          if (el) el.indeterminate = selected.size > 0 && selected.size < preview.sample.length
                        }}
                        onChange={e => toggleAll(e.target.checked)}
                      />
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)]">Date</th>
                    <th className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)]">Merchant</th>
                    <th className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] text-right">Amount</th>
                    <th className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)]">Type</th>
                    <th className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)]">Category</th>
                    <th className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] hidden sm:table-cell">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {preview.sample.map(t => {
                    const type: TxnType = typeOverrides[t.hash] ?? t.txnType
                    const checked = selected.has(t.hash)
                    const edited = type !== t.txnType
                    return (
                      <tr key={t.hash} className={cn(!checked && 'opacity-40')}>
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            className="align-middle accent-[color:var(--accent)]"
                            aria-label={`Include ${t.merchant} on ${t.date}`}
                            checked={checked}
                            onChange={() => toggleRow(t.hash)}
                          />
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-[var(--muted-foreground)]">{t.date}</td>
                        <td className="px-3 py-1.5">{t.merchant}</td>
                        <td
                          className={cn(
                            'px-3 py-1.5 text-right font-medium whitespace-nowrap',
                            TXN_TYPE_COLORS[type] ?? 'text-[var(--foreground)]',
                          )}
                        >
                          {type === 'income' ? '+' : type === 'expense' ? '-' : ''}
                          {money(t.amount)}
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={type}
                            onChange={e => setRowType(t.hash, e.target.value as TxnType)}
                            className={cn(
                              'rounded-lg border-2 bg-[var(--card)] px-1.5 py-1 text-xs',
                              edited
                                ? 'border-[color:var(--accent)]'
                                : 'border-[var(--border-soft)]',
                            )}
                            aria-label={`Type for ${t.merchant} on ${t.date}`}
                          >
                            {TXN_TYPES.map(tt => (
                              <option key={tt} value={tt}>
                                {TXN_TYPE_LABEL[tt]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">{t.category}</td>
                        <td className="px-3 py-1.5 hidden sm:table-cell text-[var(--muted-foreground)]">{t.account}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">
              Nothing new to import — everything in these files is already in your ledger.
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={onCommit} disabled={!preview.canCommit || busy || selected.size === 0}>
              {busy ? 'Uploading…' : `Confirm upload${selected.size ? ` (${selected.size})` : ''}`}
            </Button>
            <button
              onClick={() => setPreview(null)}
              disabled={busy}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && result.ok && (
        <div className="rounded-xl border-2 border-[color:var(--accent)] bg-[var(--muted)] px-4 py-3 text-sm space-y-1">
          {result.inserted > 0 ? (
            <>
              <div className="font-semibold">
                Imported {result.inserted} transaction{result.inserted !== 1 ? 's' : ''}.
              </div>
              {result.periodStart && (
                <div className="text-[var(--muted-foreground)]">
                  {result.periodStart} → {result.periodEnd}
                  {' · '}
                  <Link
                    href={`/${result.periodStart.slice(0, 4)}/${result.periodStart.slice(5, 7)}`}
                    className="font-semibold text-[color:var(--accent)] hover:underline"
                  >
                    View month →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="font-semibold">{result.message ?? 'Nothing new to import.'}</div>
          )}
        </div>
      )}
    </Card>
  )
}
