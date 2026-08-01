'use client'
import dynamic from 'next/dynamic'

export interface CategorySlice {
  category: string
  total_amount: number
  color: string
}

const DynamicDonut = dynamic(() => import('./_category-donut-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-72 animate-pulse rounded-xl bg-[var(--muted)] flex items-center justify-center">
      <span className="text-sm text-[var(--muted-foreground)]">Loading chart…</span>
    </div>
  ),
})

interface CategoryDonutProps {
  categoryTotals: CategorySlice[]
  income?: number
}

export function CategoryDonut({ categoryTotals, income }: CategoryDonutProps) {
  return <DynamicDonut categoryTotals={categoryTotals} income={income} />
}
