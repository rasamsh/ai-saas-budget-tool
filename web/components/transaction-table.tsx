'use client'
import { useState, useMemo, useEffect } from 'react'
import { Transaction, Category } from '@/lib/supabase/types'
import { formatCurrencyExact, TXN_TYPE_COLORS, TXN_TYPE_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { TransactionFlagDialog, FLAG_LABELS } from '@/components/transaction-flag-dialog'
import { Card } from '@/components/ui/card'

const FLAG_PILL_COLORS: Record<string, string> = {
  reimbursable: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  one_time:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  excluded:     'bg-[var(--muted)] text-[var(--muted-foreground)]',
}

const PAGE_SIZE = 25

interface TransactionTableProps {
  transactions: Transaction[]
  categories: Category[]
}

type SortKey = 'date' | 'amount'
type SortDir = 'asc' | 'desc'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'expense',    label: 'Expense' },
  { value: 'income',     label: 'Income' },
  { value: 'investment', label: 'Invested' },
  { value: 'debt',       label: 'Debt' },
]

export function TransactionTable({ transactions, categories }: TransactionTableProps) {
  const categoryMap = Object.fromEntries(categories.map(c => [c.name, c]))

  const uniqueCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [transactions])

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  // Reset to page 1 whenever filters or sort changes
  useEffect(() => { setPage(1) }, [selectedCategories, selectedTypes, searchText, sortKey, sortDir])

  function toggleCategory(cat: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function toggleType(type: string) {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    let result = [...transactions]

    if (selectedCategories.size > 0) {
      result = result.filter(t => selectedCategories.has(t.category))
    }
    if (selectedTypes.size > 0) {
      result = result.filter(t => selectedTypes.has(t.txn_type))
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter(t => t.merchant.toLowerCase().includes(q))
    }

    result.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') {
        cmp = a.date.localeCompare(b.date)
      } else {
        cmp = Number(a.amount) - Number(b.amount)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [transactions, selectedCategories, selectedTypes, searchText, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const filteredExpenseTotal = filtered
    .filter(t => t.txn_type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-[var(--muted-foreground)] opacity-40 ml-1">↕</span>
    return <span className="text-[color:var(--accent)] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <Card>
      {/* Filter bar */}
      <div className="p-4 border-b border-[var(--border-soft)] space-y-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search merchants…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full sm:w-72 rounded-lg border-2 border-[var(--border-soft)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[color:var(--accent-soft)] placeholder:text-[var(--muted-foreground)]"
        />

        {/* Type filters */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map(opt => {
            const active = selectedTypes.has(opt.value)
            const colorClass: Record<string, string> = {
              expense:    active ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' : '',
              income:     active ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800' : '',
              investment: active ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800' : '',
              debt:       active ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800' : '',
            }
            return (
              <button
                key={opt.value}
                onClick={() => toggleType(opt.value)}
                aria-label={`Filter by type: ${opt.label}`}
                className={cn(
                  'px-2.5 py-1 rounded-full border font-pixel text-[10px] uppercase tracking-wider transition-all duration-150',
                  active
                    ? colorClass[opt.value]
                    : 'border-[var(--border-soft)] text-[var(--muted-foreground)] hover:border-[var(--foreground)]',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Category chips */}
        {uniqueCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {uniqueCategories.map(cat => {
              const active = selectedCategories.has(cat)
              const catColor = categoryMap[cat]?.color ?? '#6b7280'
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  aria-label={`Filter by category: ${cat}`}
                  className={cn(
                    'px-2.5 py-1 rounded-full border font-pixel text-[10px] uppercase tracking-wider transition-all duration-150',
                    active
                      ? 'border-transparent text-white'
                      : 'border-[var(--border-soft)] text-[var(--muted-foreground)] hover:border-[var(--foreground)]',
                  )}
                  style={active ? { background: catColor } : undefined}
                >
                  {active ? null : (
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ background: catColor }}
                    />
                  )}
                  {cat}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted-foreground)] text-sm">
            No transactions match your filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th
                  className="text-left px-4 py-3 font-pixel text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] transition-colors select-none"
                  onClick={() => handleSort('date')}
                >
                  Date<SortIcon k="date" />
                </th>
                <th className="text-left px-4 py-3 font-pixel text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
                  Merchant
                </th>
                <th className="text-left px-4 py-3 font-pixel text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
                  Category
                </th>
                <th
                  className="text-right px-4 py-3 font-pixel text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] transition-colors select-none"
                  onClick={() => handleSort('amount')}
                >
                  Amount<SortIcon k="amount" />
                </th>
                <th className="text-left px-4 py-3 font-pixel text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider hidden sm:table-cell">
                  Account
                </th>
                <th className="text-left px-4 py-3 font-pixel text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider hidden sm:table-cell">
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {visible.map(txn => {
                const catColor = categoryMap[txn.category]?.color ?? '#6b7280'
                const amountClass = TXN_TYPE_COLORS[txn.txn_type] ?? 'text-[var(--foreground)]'
                const sign = txn.txn_type === 'income' ? '+' : txn.txn_type === 'expense' ? '-' : ''
                return (
                  <tr key={txn.id} className="hover:bg-[var(--muted)] transition-colors duration-75">
                    <td className="px-4 py-3 text-[var(--muted-foreground)] whitespace-nowrap">
                      {formatDate(txn.date)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate max-w-[140px]">{txn.merchant}</span>
                        {txn.flag && (
                          <span className={cn('px-1.5 py-0.5 rounded-full font-pixel text-[9px] uppercase tracking-wide whitespace-nowrap', FLAG_PILL_COLORS[txn.flag])}>
                            {FLAG_LABELS[txn.flag]}
                          </span>
                        )}
                        <TransactionFlagDialog transaction={txn} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: catColor }}
                        />
                        <span className="text-[var(--muted-foreground)]">{txn.category}</span>
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${amountClass}`}>
                      {sign}{formatCurrencyExact(Number(txn.amount))}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)] hidden sm:table-cell">
                      {txn.accounts?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium ${amountClass}`}>
                        {TXN_TYPE_LABELS[txn.txn_type] ?? txn.txn_type}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer: range label + expense total + pagination */}
      <div className="px-4 py-3 border-t border-[var(--border-soft)] flex items-center justify-between gap-4 text-xs text-[var(--muted-foreground)]">
        <span>
          {totalPages > 1 ? (
            <>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              {filtered.length !== transactions.length && (
                <span className="text-[var(--muted-foreground)]/60"> · {transactions.length} total</span>
              )}
            </>
          ) : (
            <>
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== transactions.length && ` of ${transactions.length}`}
            </>
          )}
          {filteredExpenseTotal > 0 && (
            <span className="ml-2 font-medium text-red-500">
              · {formatCurrencyExact(filteredExpenseTotal)} expenses
            </span>
          )}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md border border-[var(--border-soft)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:not-disabled:bg-[var(--muted)] hover:not-disabled:text-[var(--foreground)]"
              aria-label="Previous page"
            >
              ←
            </button>
            <span className="px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md border border-[var(--border-soft)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:not-disabled:bg-[var(--muted)] hover:not-disabled:text-[var(--foreground)]"
              aria-label="Next page"
            >
              →
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
