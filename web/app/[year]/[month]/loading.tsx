import { Skeleton } from '@/components/skeleton'
import { Card } from '@/components/ui/card'

export default function MonthLoading() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb + nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-44" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category donut */}
        <Card className="p-5 flex flex-col" style={{ minHeight: 280 }}>
          <Skeleton className="h-3 w-28 mb-6" />
          <div className="flex flex-1 items-center justify-center gap-8">
            <Skeleton className="h-44 w-44 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 rounded-full flex-shrink-0" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Top merchants */}
        <Card className="p-5" style={{ minHeight: 280 }}>
          <Skeleton className="h-3 w-28 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-1.5 w-full ml-6" style={{ width: `${85 - i * 14}%` }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Transaction table */}
      <div>
        <Skeleton className="h-5 w-28 mb-4" />
        <Card>
          {/* Filter bar */}
          <div className="p-4 border-b border-[var(--border-soft)] space-y-3">
            <Skeleton className="h-8 w-72" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>

          {/* Header row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-soft)]">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14 ml-auto" />
            <Skeleton className="h-3 w-20 hidden sm:block" />
            <Skeleton className="h-3 w-12 hidden sm:block" />
          </div>

          {/* Skeleton rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-soft)] last:border-0"
            >
              <Skeleton className="h-4 w-12 flex-shrink-0" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16 ml-auto flex-shrink-0" />
              <Skeleton className="h-4 w-24 hidden sm:block flex-shrink-0" />
              <Skeleton className="h-4 w-14 hidden sm:block flex-shrink-0" />
            </div>
          ))}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[var(--border-soft)]">
            <Skeleton className="h-3 w-40" />
          </div>
        </Card>
      </div>
    </div>
  )
}
