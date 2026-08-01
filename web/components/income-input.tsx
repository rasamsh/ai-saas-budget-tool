'use client'
import { useState, useRef, useTransition } from 'react'
import { setAnnualIncome } from '@/app/actions/income'
import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/card'

interface IncomeInputProps {
  year: number
  initialIncome: number
}

export function IncomeInput({ year, initialIncome }: IncomeInputProps) {
  const [income, setIncome] = useState(initialIncome)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(income > 0 ? String(income) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commit() {
    const parsed = parseFloat(draft.replace(/[^0-9.]/g, ''))
    const next = isNaN(parsed) || parsed < 0 ? income : Math.round(parsed)
    setEditing(false)
    if (next === income) return
    setIncome(next)
    startTransition(() => setAnnualIncome(year, next))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  const monthly = income > 0 ? income / 12 : null

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
          Annual Income
        </span>
        {!editing && (
          <button
            onClick={startEdit}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
            aria-label="Edit income"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[var(--muted-foreground)] text-sm">$</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            placeholder="0"
            className="w-full rounded-md border-2 border-[var(--accent)] bg-[var(--card)] px-2 py-1 text-lg font-bold outline-none ring-4 ring-[color:var(--accent-soft)] tabular-nums"
          />
        </div>
      ) : (
        <button
          onClick={startEdit}
          className="block text-left w-full group"
        >
          <span className={`text-xl font-bold tabular-nums ${isPending ? 'opacity-50' : ''} ${income === 0 ? 'text-[var(--muted-foreground)] text-base font-normal' : ''}`}>
            {income === 0 ? 'Click to set income' : formatCurrency(income)}
          </span>
        </button>
      )}

      {monthly !== null && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)] tabular-nums">
          ≈ {formatCurrency(monthly)} / month
        </p>
      )}
    </Card>
  )
}
