// ------------------------------------------------------------
// components/charts/Sparkline.tsx
//
// Tiny inline line chart — a pure SVG polyline, no charting dependency.
// Colour comes from the parent via `currentColor` (set a text-* class on it).
// Normalises the series to its own min/max, so it shows shape, not absolute
// scale. 0 points → nothing; 1 point → a single dot.
// ------------------------------------------------------------

interface SparklineProps {
  values:       number[]
  width?:       number
  height?:      number
  strokeWidth?: number
  /** Set the line colour with a text-* class, e.g. "text-command-blue". */
  className?:   string
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  strokeWidth = 2,
  className,
}: SparklineProps): React.JSX.Element | null {
  if (values.length === 0) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1        // avoid /0 when all values equal
  const n = values.length
  const pad = strokeWidth              // keep the stroke off the edges

  const x = (i: number): number => (n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2))
  const y = (v: number): number => height - pad - ((v - min) / range) * (height - pad * 2)

  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const lastX = x(n - 1)
  const lastY = y(values[n - 1])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      {n > 1 && (
        <polyline
          points={points}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Emphasise the latest point. */}
      <circle cx={lastX} cy={lastY} r={strokeWidth * 1.4} fill="currentColor" />
    </svg>
  )
}
