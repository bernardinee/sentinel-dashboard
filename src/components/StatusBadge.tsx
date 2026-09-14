const STYLES: Record<string, string> = {
  new: 'bg-red-50 text-red-700 border-red-200',
  acknowledged: 'bg-sky-50 text-sky-700 border-sky-200',
  dispatched: 'bg-brand-50 text-brand-700 border-brand-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  false_alarm: 'bg-gray-100 text-gray-500 border-gray-200',
}

const LABELS: Record<string, string> = {
  new: 'New',
  acknowledged: 'Acknowledged',
  dispatched: 'Dispatched',
  resolved: 'Resolved',
  false_alarm: 'False alarm',
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
      STYLES[status] ?? STYLES.false_alarm}`}>
      {LABELS[status] ?? status.replace('_', ' ')}
    </span>
  )
}
