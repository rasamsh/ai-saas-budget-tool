import { buildSankeyLayout } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'

// ---------------------------------------------------------------------------
// SVG layout constants
// ---------------------------------------------------------------------------
const VB_W  = 560   // total viewBox width
const VB_H  = 260   // total viewBox height
const NW    = 18    // node rectangle width
const SRC_X = 82    // source node left edge
const SNK_X = VB_W - NW - 82  // sink node left edge (460)
const X1    = SRC_X + NW      // ribbon start x (100)
const X2    = SNK_X            // ribbon end x (460)
const MX    = (X1 + X2) / 2   // bezier midpoint x (280)

// Minimum height in pixels for a sink to receive a text label
const MIN_LABEL_H = 14

// ---------------------------------------------------------------------------
// Bezier ribbon path for a Sankey link
// sy/sh/ty/th are already in SVG pixels (not normalized)
// ---------------------------------------------------------------------------
function ribbonPath(sy: number, sh: number, ty: number, th: number): string {
  return [
    `M ${X1} ${sy}`,
    `C ${MX} ${sy}, ${MX} ${ty}, ${X2} ${ty}`,
    `L ${X2} ${ty + th}`,
    `C ${MX} ${sy + sh}, ${MX} ${sy + sh}, ${X1} ${sy + sh}`,
    'Z',
  ].join(' ')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CashFlowWaterfallProps {
  income: number
  expenses: number
  debt: number
  invested: number
}

export function CashFlowWaterfall({ income, expenses, debt, invested }: CashFlowWaterfallProps) {
  const layout = buildSankeyLayout(income, expenses, debt, invested)

  if (!layout) {
    return (
      <Card className="p-6">
        <Eyebrow className="block mb-2">Cash Flow</Eyebrow>
        <p className="text-sm text-[var(--muted-foreground)]">
          Set your income to see the cash flow breakdown.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Cash Flow</Eyebrow>
        {layout.hasNegative && (
          <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900">
            Over budget
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Cash flow Sankey diagram"
      >
        {/* Ribbons */}
        {layout.links.map(link => {
          const sy = link.sy * VB_H
          const sh = link.sh * VB_H
          const ty = link.ty * VB_H
          const th = link.th * VB_H
          if (th < 0.5) return null
          return (
            <path
              key={link.label}
              data-testid="ribbon"
              data-label={link.label}
              d={ribbonPath(sy, sh, ty, th)}
              fill={link.color}
              opacity={0.2}
            />
          )
        })}

        {/* Source node (Income bar) — height matches sourceH so it stays on the
            same scale as the sinks below (shorter than full height when spending
            exceeds income, since sinks are then scaled by total spend instead) */}
        <rect
          data-testid="income-bar"
          x={SRC_X}
          y={0}
          width={NW}
          height={Math.max(1, layout.sourceH * VB_H)}
          fill="#94a3b8"
          rx={3}
        />

        {/* Sink nodes */}
        {layout.sinks.map(sink => {
          const y = sink.y * VB_H
          const h = Math.max(1, sink.h * VB_H)
          return (
            <rect
              key={sink.label}
              data-testid="sink-bar"
              x={SNK_X}
              y={y}
              width={NW}
              height={h}
              fill={sink.color}
              rx={3}
            />
          )
        })}

        {/* Source label: "Income" + amount, vertically centered on the (possibly scaled-down) bar */}
        <text
          x={SRC_X - 10}
          y={(Math.max(1, layout.sourceH * VB_H)) / 2 - 8}
          textAnchor="end"
          fontSize={12}
          fontWeight={600}
          fill="currentColor"
          className="fill-[var(--foreground)]"
        >
          Income
        </text>
        <text
          x={SRC_X - 10}
          y={(Math.max(1, layout.sourceH * VB_H)) / 2 + 8}
          textAnchor="end"
          fontSize={11}
          fill="currentColor"
          className="fill-[var(--muted-foreground)]"
        >
          {formatCurrency(income)}
        </text>

        {/* Sink labels: label + amount, vertically centered on each sink */}
        {layout.sinks.map(sink => {
          const cy = (sink.y + sink.h / 2) * VB_H
          const pixH = sink.h * VB_H
          if (pixH < MIN_LABEL_H) return null
          return (
            <g key={`lbl-${sink.label}`}>
              <text
                x={SNK_X + NW + 10}
                y={cy - 7}
                textAnchor="start"
                fontSize={12}
                fontWeight={600}
                fill={sink.color}
              >
                {sink.label}
              </text>
              <text
                x={SNK_X + NW + 10}
                y={cy + 7}
                textAnchor="start"
                fontSize={11}
                fill="currentColor"
                className="fill-[var(--muted-foreground)]"
              >
                {formatCurrency(sink.amount)}
              </text>
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
