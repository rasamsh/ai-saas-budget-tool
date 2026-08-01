'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Transaction, TransactionFlag } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'

const FLAG_OPTIONS: { value: TransactionFlag | ''; label: string }[] = [
  { value: '',              label: 'None' },
  { value: 'reimbursable',  label: 'Reimbursable' },
  { value: 'one_time',      label: 'One-time' },
  { value: 'excluded',      label: 'Excluded from totals' },
]

export const FLAG_LABELS: Record<string, string> = {
  reimbursable: 'Reimbursable',
  one_time: 'One-time',
  excluded: 'Excluded',
}

interface Props {
  transaction: Transaction
}

export function TransactionFlagDialog({ transaction }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [flag, setFlag] = useState<TransactionFlag | ''>(transaction.flag ?? '')
  const [notes, setNotes] = useState(transaction.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openDialog() {
    setFlag(transaction.flag ?? '')
    setNotes(transaction.notes ?? '')
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase
      .from('transactions')
      .update({ flag: flag || null, notes: notes.trim() || null })
      .eq('id', transaction.id)

    setLoading(false)
    if (err) { setError(err.message); return }

    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openDialog}
        aria-label={`Flag or add notes for ${transaction.merchant}`}
        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        ⚑
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-[var(--radius-card)] border-2 border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold mb-5">{transaction.merchant}</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="txn-flag" className="block text-sm font-medium mb-1.5">Flag</label>
                <select
                  id="txn-flag"
                  value={flag}
                  onChange={e => setFlag(e.target.value as TransactionFlag | '')}
                  className="w-full rounded-xl border-2 border-[var(--border-soft)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
                >
                  {FLAG_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="txn-notes" className="block text-sm font-medium mb-1.5">Notes</label>
                <textarea
                  id="txn-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Business lunch with client"
                  className="w-full rounded-xl border-2 border-[var(--border-soft)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[color:var(--accent-soft)] resize-none"
                />
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
