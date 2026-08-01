import { Anomaly } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils'
import { Mascot } from '@/components/ui/mascot'

interface AnomalyBannerProps {
  anomalies: Anomaly[]
}

export function AnomalyBanner({ anomalies }: AnomalyBannerProps) {
  if (anomalies.length === 0) return null

  const shown = anomalies.slice(0, 3)

  return (
    <div
      className="rounded-[var(--radius-card)] border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3"
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <Mascot mood="concerned" size={40} className="mt-0.5 flex-shrink-0" />
      <div className="space-y-1">
        <h3 className="font-display text-sm font-bold text-amber-800 dark:text-amber-300">Heads up</h3>
        {shown.map(a => (
          <p key={a.category} className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">{a.category}</span>
            {' '}is {Math.round(a.pctAboveAverage)}% above your 6-month average
            {' '}({formatCurrency(a.current)} vs {formatCurrency(a.average)} avg)
          </p>
        ))}
      </div>
    </div>
  )
}
