// Unit recommendation + assignment. Units are ranked by ROAD travel time, not
// straight-line distance — in Accra the nearest unit as the crow flies is
// routinely not the fastest once the ring roads and the lagoon are accounted
// for, which is the entire point of routing properly.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { hasFix } from '../lib/format'
import {
  UNIT_COLOR, UNIT_LABEL, UNIT_STATUS_LABEL, UNIT_STATUS_STYLE, UNIT_TINT,
  etaTone, unitIconPath,
} from '../lib/units'
import type { DispatchOption, IncidentDetail, UnitType } from '../lib/types'

function UnitIcon({ type, className = 'w-4 h-4' }: { type: UnitType; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d={unitIconPath(type)} />
    </svg>
  )
}

function OptionRow({ option, actor, incidentId, onHover, disabled }: {
  option: DispatchOption
  actor: string
  incidentId: string
  onHover: (o: DispatchOption | null) => void
  disabled: boolean
}) {
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const u = option.unit

  const assign = useMutation({
    mutationFn: () => api.assignUnit(incidentId, u.call_sign, actor),
    onSuccess: () => {
      setError('')
      qc.invalidateQueries({ queryKey: ['incident', incidentId] })
      qc.invalidateQueries({ queryKey: ['dispatchOptions', incidentId] })
      qc.invalidateQueries({ queryKey: ['units'] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div
      onMouseEnter={() => onHover(option)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-2.5 sm:gap-3 p-3 rounded-xl border transition-colors flex-wrap ${
        option.recommended
          ? 'border-brand-200 bg-brand-50/60'
          : 'border-ground-line bg-ground-card hover:border-gray-300'}`}
    >
      <div className={`icon-tile ${UNIT_TINT[u.unit_type]}`}>
        <UnitIcon type={u.unit_type} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-ink whitespace-nowrap">{u.call_sign}</span>
          {option.recommended && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md
                             bg-brand-700 text-white">FASTEST</span>
          )}
        </div>
        <p className="text-[11px] text-ink-soft truncate">
          {UNIT_LABEL[u.unit_type]} · {u.station_name}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-sm font-bold tabular-nums ${etaTone(option.eta_min)}`}>
          {option.eta_min.toFixed(0)} min
        </p>
        <p className="text-[10px] text-ink-faint tabular-nums">
          {option.route.distance_km.toFixed(1)} km
          {option.route.source !== 'osrm' && ' (est.)'}
        </p>
      </div>

      <button
        disabled={disabled || assign.isPending}
        onClick={() => assign.mutate()}
        className="shrink-0 px-3 py-1.5 rounded-xl bg-brand-700 hover:bg-brand-800
                   text-white text-xs font-semibold disabled:opacity-40
                   disabled:cursor-not-allowed transition-colors"
      >
        {assign.isPending ? 'Sending…' : 'Dispatch'}
      </button>

      {error && <p className="text-[11px] text-red-600 basis-full">{error}</p>}
    </div>
  )
}

export default function DispatchPanel({ incident, actor, onPreview }: {
  incident: IncidentDetail
  actor: string
  onPreview: (o: DispatchOption | null) => void
}) {
  const qc = useQueryClient()
  const closed = ['resolved', 'false_alarm'].includes(incident.status)
  const located = hasFix(incident.lat, incident.lon)

  const { data, isLoading, error } = useQuery({
    queryKey: ['dispatchOptions', incident.id],
    queryFn: () => api.dispatchOptions(incident.id),
    enabled: located && !closed,
    refetchInterval: 60000,
  })

  const { data: units } = useQuery({ queryKey: ['units'], queryFn: api.units })
  const assigned = (units ?? []).filter(u => u.assigned_incident_id === incident.id)

  const advance = useMutation({
    mutationFn: ({ callSign, status }: { callSign: string; status: 'en_route' | 'on_scene' | 'available' }) =>
      api.setUnitStatus(callSign, status, actor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] })
      qc.invalidateQueries({ queryKey: ['incident', incident.id] })
      qc.invalidateQueries({ queryKey: ['dispatchOptions', incident.id] })
    },
  })

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="section-label">Dispatch units</h3>
        {data && data.routing_source === 'osrm' && (
          <span className="text-[10px] text-ink-faint">road routing · OSRM</span>
        )}
      </div>
      <p className="text-[11px] text-ink-soft mb-3">
        Ranked by road travel time to the scene, not straight-line distance.
      </p>

      {/* already on the job */}
      {assigned.length > 0 && (
        <div className="mb-3 space-y-2">
          {assigned.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl
                                       border border-ground-line bg-ground">
              <div className="icon-tile" style={{ backgroundColor: `${UNIT_COLOR[u.unit_type]}18`,
                                                  color: UNIT_COLOR[u.unit_type] }}>
                <UnitIcon type={u.unit_type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-ink whitespace-nowrap">{u.call_sign}</p>
                <p className="text-[11px] text-ink-soft truncate">{u.station_name}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                UNIT_STATUS_STYLE[u.status]}`}>
                {UNIT_STATUS_LABEL[u.status]}
              </span>
              {u.status === 'dispatched' && (
                <button onClick={() => advance.mutate({ callSign: u.call_sign, status: 'en_route' })}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700
                             text-white text-[11px] font-semibold">En route</button>
              )}
              {u.status === 'en_route' && (
                <button onClick={() => advance.mutate({ callSign: u.call_sign, status: 'on_scene' })}
                  className="px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700
                             text-white text-[11px] font-semibold">On scene</button>
              )}
              {u.status === 'on_scene' && (
                <button onClick={() => advance.mutate({ callSign: u.call_sign, status: 'available' })}
                  className="px-2.5 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300
                             text-ink text-[11px] font-semibold">Clear</button>
              )}
            </div>
          ))}
        </div>
      )}

      {!located && (
        <p className="text-xs text-ink-soft py-4 text-center">
          This incident has no GPS fix, so units cannot be routed to it.
        </p>
      )}
      {closed && (
        <p className="text-xs text-ink-soft py-4 text-center">
          Incident is {incident.status.replace('_', ' ')} — dispatch is closed.
        </p>
      )}
      {isLoading && located && !closed && (
        <p className="text-xs text-ink-soft py-4 text-center">Calculating routes…</p>
      )}
      {error && (
        <p className="text-xs text-red-600 py-3">{(error as Error).message}</p>
      )}

      {data && (
        <>
          {data.required_types.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
              <span className="text-[11px] text-ink-soft">Recommended for this severity:</span>
              {data.required_types.map(t => (
                <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${UNIT_TINT[t]}`}>
                  {UNIT_LABEL[t]}
                </span>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {data.options.map(o => (
              <OptionRow key={o.unit.id} option={o} actor={actor} incidentId={incident.id}
                onHover={onPreview}
                disabled={closed || o.unit.assigned_incident_id === incident.id} />
            ))}
          </div>
          {data.options.length === 0 && (
            <p className="text-xs text-ink-soft py-4 text-center">
              No units are available. Free one up under Fleet.
            </p>
          )}
          {data.note && (
            <p className="text-[11px] text-ink-soft mt-3 leading-relaxed">{data.note}</p>
          )}
        </>
      )}
    </div>
  )
}
