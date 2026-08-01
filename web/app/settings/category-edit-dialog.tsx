'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, TxnType } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const TXN_TYPES: { value: TxnType; label: string }[] = [
  { value: 'expense',    label: 'Expense' },
  { value: 'income',     label: 'Income' },
  { value: 'investment', label: 'Investment' },
  { value: 'debt',       label: 'Debt' },
]

interface Props {
  mode: 'create' | 'edit'
  category?: Category
}

export function CategoryEditDialog({ mode, category }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(category?.name ?? '')
  const [txnType, setTxnType] = useState<TxnType>(category?.txn_type ?? 'expense')
  const [color, setColor] = useState(category?.color ?? '#6b7280')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setName(category?.name ?? '')
    setTxnType(category?.txn_type ?? 'expense')
    setColor(category?.color ?? '#6b7280')
    setError(null)
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Category name is required.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()

    if (mode === 'create') {
      const { error: err } = await supabase.from('categories').insert({
        name: name.trim(),
        txn_type: txnType,
        color,
      })
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      // When editing, the PK is name — if name changed, we need to handle carefully
      // For simplicity: update color and txn_type only if name hasn't changed,
      // otherwise delete + insert
      if (category && name.trim() !== category.name) {
        const { error: insErr } = await supabase.from('categories').insert({
          name: name.trim(),
          txn_type: txnType,
          color,
        })
        if (insErr) { setError(insErr.message); setLoading(false); return }
        // Note: do NOT delete old — could break existing transactions
      } else {
        const { error: err } = await supabase
          .from('categories')
          .update({ txn_type: txnType, color })
          .eq('name', category?.name ?? name)
        if (err) { setError(err.message); setLoading(false); return }
      }
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      {mode === 'create' ? (
        <Button variant="primary" onClick={() => { resetForm(); setOpen(true) }}>
          + Add category
        </Button>
      ) : (
        <button
          onClick={() => { resetForm(); setOpen(true) }}
          className="text-xs font-semibold text-[color:var(--accent)] hover:underline transition-colors"
        >
          Edit
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Dialog */}
          <div className="relative z-10 w-full max-w-sm rounded-[var(--radius-card)] border-2 border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold mb-5">
              {mode === 'create' ? 'New Category' : `Edit: ${category?.name}`}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Groceries"
                  className="w-full rounded-xl border-2 border-[var(--border-soft)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
                  disabled={mode === 'edit' && !!category}
                />
                {mode === 'edit' && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Category name is the primary key and cannot be changed.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Type</label>
                <select
                  value={txnType}
                  onChange={e => setTxnType(e.target.value as TxnType)}
                  className="w-full rounded-xl border-2 border-[var(--border-soft)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
                >
                  {TXN_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border-2 border-[var(--border-soft)] cursor-pointer bg-transparent p-0.5"
                  />
                  <span className="text-sm font-mono text-[var(--muted-foreground)]">{color}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
