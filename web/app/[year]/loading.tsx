import { Skeleton } from '@/components/skeleton'
import { Card } from '@/components/ui/card'

export default function YearLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-8 w-36" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>

      {/* Annual chart */}
      <Card className="p-5">
        <Skeleton className="h-4 w-32 mb-6" />
        <div className="flex items-end gap-3 h-48 px-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1 items-center justify-end">
              <Skeleton
                className="w-full rounded-t"
                style={{ height: `${30 + Math.sin(i * 0.7) * 20 + Math.random() * 30}%` }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Month grid */}
      <div>
        <Skeleton className="h-5 w-20 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-2.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-20" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
