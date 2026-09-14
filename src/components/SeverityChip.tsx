const STYLES: Record<string, string> = {
  Normal: 'bg-green-950/60 text-green-400 border-green-800',
  Moderate: 'bg-amber-950/60 text-amber-400 border-amber-700',
  Severe: 'bg-red-950/70 text-red-400 border-red-700',
  pending: 'bg-slate-800 text-slate-400 border-slate-600',
}

export default function SeverityChip({ name, pending, big }: {
  name: string | null
  pending?: boolean
  big?: boolean
}) {
  const label = pending ? 'PENDING' : (name ?? '—').toUpperCase()
  const cls = STYLES[pending ? 'pending' : name ?? 'pending'] ?? STYLES.pending
  return (
    <span className={`inline-flex items-center border rounded-md font-bold tracking-wide ${cls} ${
      big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'}`}>
      {label}
    </span>
  )
}
