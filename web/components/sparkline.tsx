interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
}

export function Sparkline({ values, width = 80, height = 24, color = '#ef4444' }: SparklineProps) {
  const max = Math.max(...values)
  if (max === 0 || values.every(v => v === 0)) return null

  const nonZeroCount = values.filter(v => v > 0).length
  if (nonZeroCount < 2) return null

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - (v / max) * (height - 2) - 1 // 1px padding top/bottom
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible opacity-60"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
