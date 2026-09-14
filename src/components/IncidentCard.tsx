import { Link } from 'react-router-dom'
import SeverityChip from './SeverityChip'
import StatusBadge from './StatusBadge'
import { clock, coords, severityColor, timeAgo } from '../lib/format'
import type { Incident } from '../lib/types'

export default function IncidentCard({ incident, deviceName, nowMs, assignedUnits }: {
  incident: Incident
  deviceName?: string
  nowMs: number
  assignedUnits?: string[]
}) {
  const unacked = incident.status === 'new' && incident.accident_confirmed
  return (
    <Link to={`/incidents/${incident.id}`}
      className={`block panel p-3.5 hover:shadow-lift transition-shadow animate-slide-in ${
        unacked ? 'pulse-unacked border-red-200' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: severityColor(incident.severity_class) }} />
          <SeverityChip name={incident.severity_name} pending={incident.classification_pending} />
          <StatusBadge status={incident.status} />
        </div>
        <span className="text-[11px] text-ink-faint tabular-nums shrink-0"
          title={incident.received_at}>{clock(incident.received_at)}</span>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-ink font-medium truncate">{deviceName ?? incident.event_id}</span>
        <span className="text-ink-soft tabular-nums">{timeAgo(incident.received_at, nowMs)}</span>
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] text-ink-soft tabular-nums">
        <span>peak <b className="text-ink">{(incident.peak_g ?? incident.trigger_peak_g)?.toFixed(2) ?? '—'} g</b></span>
        <span>conf <b className="text-ink">{incident.confidence != null ? `${(incident.confidence * 100).toFixed(0)}%` : '—'}</b></span>
        <span className="truncate" title={coords(incident.lat, incident.lon)}>
          {coords(incident.lat, incident.lon)}
        </span>
      </div>

      {assignedUnits && assignedUnits.length > 0 && (
        <div className="mt-2 pt-2 border-t border-ground-line flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-ink-faint">Responding:</span>
          {assignedUnits.map(cs => (
            <span key={cs} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                                      bg-brand-50 text-brand-700">{cs}</span>
          ))}
        </div>
      )}
    </Link>
  )
}
