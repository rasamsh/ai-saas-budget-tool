'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  account: Account
}

export function AccountEditDialog({ account }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(account.name)
  const [bank, setBank] = useState(account.bank)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setName(account.name)
    setBank(account.bank)
    setError(null)
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Account name is required.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase
      .from('accounts')
      .update({ name: name.trim(), bank: bank.trim() })
      .eq('id', account.id)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => { resetForm(); setOpen(true) }}
        className="text-xs font-semibold text-[color:var(--accent)] hover:underline transition-colors"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-[var(--radius-card)] border-2 border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold mb-5">Edit Account</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Account Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Chase Checking"
                  className="w-full rounded-xl border-2 border-[var(--border-soft)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Bank</label>
                <input
                  type="text"
                  value={bank}
                  onChange={e => setBank(e.target.value)}
                  placeholder="e.g. Chase"
                  className="w-full rounded-xl border-2 border-[var(--border-soft)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
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
