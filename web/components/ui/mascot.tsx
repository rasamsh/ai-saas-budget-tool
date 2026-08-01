import { cn } from '@/lib/utils'

type MascotMood = 'neutral' | 'celebrating' | 'concerned'

interface MascotProps {
  size?: number
  mood?: MascotMood
  className?: string
}

/**
 * "Ledgi" - a small pixel-art robot mascot drawn as SVG rect grid art.
 */
export function Mascot({ size = 48, mood = 'neutral', className }: MascotProps) {
  const ink = 'var(--foreground)'
  const accent = 'var(--accent)'
  const screen = 'var(--card)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label="Ledgii mascot"
      shapeRendering="crispEdges"
      className={cn(className)}
    >
      {/* antenna */}
      <rect x="6" y="0" width="3" height="1" fill={accent} />
      <rect x="7" y="1" width="1" height="2" fill={ink} />
      {/* side knobs */}
      <rect x="1" y="6" width="1" height="3" fill={ink} />
      <rect x="14" y="6" width="1" height="3" fill={ink} />
      {/* head */}
      <rect x="2" y="3" width="12" height="9" rx="2" fill={accent} stroke={ink} strokeWidth="1" />
      {/* screen face */}
      <rect x="3.5" y="4.5" width="9" height="4" rx="1" fill={screen} />

      {mood === 'concerned' ? (
        <>
          <rect x="5" y="5.3" width="1.8" height="2" fill={ink} />
          <rect x="9.2" y="5.3" width="1.8" height="2" fill={ink} />
          <rect x="6.5" y="7.6" width="3" height="0.6" rx="0.3" fill={ink} />
        </>
      ) : mood === 'celebrating' ? (
        <>
          <rect x="5.2" y="5.2" width="1.6" height="1.4" fill={ink} />
          <rect x="9.2" y="5.2" width="1.6" height="1.4" fill={ink} />
          <rect x="6" y="6.9" width="4" height="1.4" rx="0.7" fill={screen} stroke={ink} strokeWidth="0.5" />
          <rect x="0" y="2" width="1" height="1" fill={accent} />
          <rect x="15" y="4" width="1" height="1" fill={accent} />
        </>
      ) : (
        <>
          <rect x="5.2" y="5.4" width="1.6" height="1.8" fill={ink} />
          <rect x="9.2" y="5.4" width="1.6" height="1.8" fill={ink} />
          <rect x="6" y="7.4" width="4" height="0.7" rx="0.35" fill={ink} />
        </>
      )}

      {/* legs */}
      <rect x="5" y="12" width="1.6" height="1.6" fill={ink} />
      <rect x="9.4" y="12" width="1.6" height="1.6" fill={ink} />
    </svg>
  )
}
