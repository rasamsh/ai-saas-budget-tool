import { RecurringItem } from '@/lib/finance'
import { formatCurrency, formatCurrencyExact } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'

interface RecurringSubscriptionsProps {
  items: RecurringItem[]
}

export function RecurringSubscriptions({ items }: RecurringSubscriptionsProps) {
  const annualTotal = items.reduce((s, i) => s + i.annualTotal, 0)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Eyebrow>Recurring Subscriptions</Eyebrow>
        {items.length > 0 && (
          <span className="text-sm text-[var(--muted-foreground)]">
            {formatCurrency(annualTotal)} / yr
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No recurring subscriptions detected. Subscriptions must appear in 2+ months to be listed.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.merchant} className="flex items-center justify-between py-2 border-b border-[var(--border-soft)] last:border-0">
              <div>
                <div className="text-sm font-medium">{item.merchant}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {item.months} month{item.months !== 1 ? 's' : ''} · {formatCurrency(item.annualTotal)} / yr
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrencyExact(item.monthlyAvg)}<span className="text-xs text-[var(--muted-foreground)] font-normal">/mo</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
