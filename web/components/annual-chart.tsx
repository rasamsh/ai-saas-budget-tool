'use client'
import dynamic from 'next/dynamic'
import { MonthlySummary } from '@/lib/supabase/types'

const DynamicChart = dynamic(() => import('./_annual-chart-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-72 animate-pulse rounded-xl bg-[var(--muted)] flex items-center justify-center">
      <span className="text-sm text-[var(--muted-foreground)]">Loading chart…</span>
    </div>
  ),
})

export function AnnualChart({ summaries, year }: { summaries: MonthlySummary[], year: number }) {
  return <DynamicChart summaries={summaries} year={year} />
}
