// Tiny inline SVG sparkline for heartbeat history panels.
export default function Sparkline({ values, width = 140, height = 32, color = '#38bdf8' }: {
  values: (number | null)[]
  width?: number
  height?: number
  color?: string
}) {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) {
    return <span className="text-[10px] text-ink-faint">no data</span>
  }
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const pts = values
    .map((v, i) => v == null ? null : `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`)
    .filter(Boolean)
    .join(' ')
  return (
    <svg width={width} height={height} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
