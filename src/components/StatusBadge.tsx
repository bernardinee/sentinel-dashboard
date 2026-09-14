const STYLES: Record<string, string> = {
  new: 'bg-red-950/50 text-red-300 border-red-900',
  acknowledged: 'bg-sky-950/50 text-sky-300 border-sky-900',
  dispatched: 'bg-indigo-950/50 text-indigo-300 border-indigo-900',
  resolved: 'bg-emerald-950/50 text-emerald-300 border-emerald-900',
  false_alarm: 'bg-slate-800 text-slate-400 border-slate-700',
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
      STYLES[status] ?? STYLES.false_alarm}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  )
}
