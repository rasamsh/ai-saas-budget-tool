import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Mascot } from '@/components/ui/mascot'
import { ImportUploader } from './import-uploader'

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
}

export default async function ImportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: batches }, { data: accounts }] = await Promise.all([
    supabase
      .from('import_batches')
      .select('*')
      .eq('user_id', user.id)
      .order('imported_at', { ascending: false }),
    supabase.from('accounts').select('name, bank').eq('user_id', user.id).order('name'),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--muted-foreground)] mb-1">
            <Link href="/settings" className="hover:text-[var(--foreground)] transition-colors">
              Settings
            </Link>
            {' / '}
            <span>Import</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold">Import</h1>
        </div>
      </div>

      <ImportUploader accounts={accounts ?? []} />

      <h2 className="font-display text-lg font-bold pt-2">Import history</h2>

      <Card className="overflow-hidden">
        {!batches?.length ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <Mascot size={64} />
            <div>
              <h2 className="font-display text-xl font-bold">No imports yet</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Run the CLI pipeline to import your bank statements.
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  Imported
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide hidden sm:table-cell">
                  Period
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  Files
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  Transactions
                </th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {batches.map(batch => {
                // Derive the year/month from period_start for the "view" link
                const startDate = new Date(batch.period_start + 'T00:00:00')
                const viewYear  = startDate.getFullYear()
                const viewMonth = (startDate.getMonth() + 1).toString().padStart(2, '0')

                return (
                  <tr key={batch.id} className="hover:bg-[var(--muted)] transition-colors duration-75">
                    <td className="px-4 py-3 text-[var(--foreground)]">
                      <div className="font-medium">{formatDateTime(batch.imported_at)}</div>
                      <div className="text-xs text-[var(--muted-foreground)] sm:hidden mt-0.5">
                        {formatPeriod(batch.period_start, batch.period_end)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)] hidden sm:table-cell">
                      {formatPeriod(batch.period_start, batch.period_end)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted-foreground)]">
                      {batch.file_count}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {batch.transaction_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${viewYear}/${viewMonth}`}
                        className="text-xs font-semibold text-[color:var(--accent)] hover:underline transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {batches && batches.length > 0 && (
        <p className="text-xs text-[var(--muted-foreground)] text-right">
          {batches.length} import{batches.length !== 1 ? 's' : ''} · {batches.reduce((s, b) => s + b.transaction_count, 0).toLocaleString()} total transactions
        </p>
      )}
    </div>
  )
}
