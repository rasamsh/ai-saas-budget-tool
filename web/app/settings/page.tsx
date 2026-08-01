import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CategoryEditDialog } from './category-edit-dialog'
import { AccountEditDialog } from './account-edit-dialog'
import { Card } from '@/components/ui/card'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
  ])

  // Get transaction counts per category
  const { data: catCounts } = await supabase
    .from('transactions')
    .select('category')
    .eq('user_id', user.id)

  const categoryCountMap: Record<string, number> = {}
  catCounts?.forEach(r => {
    categoryCountMap[r.category] = (categoryCountMap[r.category] ?? 0) + 1
  })

  // Get transaction counts per account
  const { data: acctCounts } = await supabase
    .from('transactions')
    .select('account_id')
    .eq('user_id', user.id)

  const accountCountMap: Record<string, number> = {}
  acctCounts?.forEach(r => {
    accountCountMap[r.account_id] = (accountCountMap[r.account_id] ?? 0) + 1
  })

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold">Settings</h1>
        <Link
          href="/settings/imports"
          className="text-sm font-semibold text-[color:var(--accent)] hover:underline transition-colors"
        >
          View import log →
        </Link>
      </div>

      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold">Categories</h2>
          <CategoryEditDialog mode="create" />
        </div>

        <Card className="overflow-hidden">
          {!categories?.length ? (
            <div className="p-8 text-center text-[var(--muted-foreground)] text-sm">
              No categories yet. Add one to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    Color
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    Transactions
                  </th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {categories.map(cat => (
                  <tr key={cat.name} className="hover:bg-[var(--muted)] transition-colors duration-75">
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 capitalize text-[var(--muted-foreground)]">
                      {cat.txn_type}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded border border-[var(--border-soft)]"
                          style={{ background: cat.color }}
                        />
                        <span className="text-xs text-[var(--muted-foreground)] font-mono">{cat.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted-foreground)]">
                      {categoryCountMap[cat.name] ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CategoryEditDialog mode="edit" category={cat} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      {/* Accounts */}
      <section>
        <h2 className="font-display text-lg font-bold mb-4">Accounts</h2>
        <Card className="overflow-hidden">
          {!accounts?.length ? (
            <div className="p-8 text-center text-[var(--muted-foreground)] text-sm">
              No accounts linked. Import transactions to see your accounts.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    Bank
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    Transactions
                  </th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {accounts.map(acct => (
                  <tr key={acct.id} className="hover:bg-[var(--muted)] transition-colors duration-75">
                    <td className="px-4 py-3 font-medium">{acct.name}</td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{acct.bank}</td>
                    <td className="px-4 py-3 text-right text-[var(--muted-foreground)]">
                      {accountCountMap[acct.id] ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AccountEditDialog account={acct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  )
}
