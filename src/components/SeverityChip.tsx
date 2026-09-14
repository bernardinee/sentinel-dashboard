const STYLES: Record<string, string> = {
  Normal: 'bg-green-50 text-green-700 border-green-200',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  Severe: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-gray-100 text-gray-500 border-gray-200',
}

export default function SeverityChip({ name, pending, big }: {
  name: string | null
  pending?: boolean
  big?: boolean
}) {
  const label = pending ? 'Pending' : (name ?? '—')
  const cls = STYLES[pending ? 'pending' : name ?? 'pending'] ?? STYLES.pending
  return (
    <span className={`inline-flex items-center border rounded-lg font-semibold ${cls} ${
      big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'}`}>
      {label}
    </span>
  )
}
