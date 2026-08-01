import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'

export interface MerchantRow {
  merchant: string
  total: number
  count: number
}

interface TopMerchantsProps {
  merchants: MerchantRow[]
}

export function TopMerchants({ merchants }: TopMerchantsProps) {
  if (!merchants.length) {
    return (
      <Card className="p-8 text-center flex items-center justify-center min-h-[280px]">
        <p className="text-[var(--muted-foreground)] text-sm">No merchant data for this month.</p>
      </Card>
    )
  }

  const maxTotal = merchants[0]?.total ?? 1

  return (
    <Card className="p-5">
      <Eyebrow className="block mb-4">Top Merchants</Eyebrow>
      <div className="space-y-3">
        {merchants.map((m, i) => {
          const barWidth = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-[var(--muted-foreground)] w-4 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium">{m.merchant}</span>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {m.count} txn{m.count !== 1 ? 's' : ''}
                  </span>
                  <span className="font-semibold">{formatCurrency(m.total)}</span>
                </div>
              </div>
              <div className="ml-6 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-400"
                  style={{ width: `${barWidth}%`, transition: 'width 300ms ease' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
