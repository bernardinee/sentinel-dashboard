// Fleet overview: every unit, its status, and where it is right now.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  UNIT_COLOR, UNIT_LABEL, UNIT_STATUS_LABEL, UNIT_STATUS_STYLE, UNIT_TINT,
  unitIconPath,
} from '../lib/units'
import MapView, { unitPins, incidentPins } from '../components/MapView'
import type { Unit, UnitType } from '../lib/types'

const TYPES: UnitType[] = ['AMBULANCE', 'FIRE', 'POLICE', 'RESCUE']

function UnitIcon({ type, className = 'w-4 h-4' }: { type: UnitType; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d={unitIconPath(type)} />
    </svg>
  )
}

function AddUnitForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    call_sign: '', unit_type: 'AMBULANCE' as UnitType, station_name: '',
    home_lat: '', home_lon: '', crew_size: '',
  })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => api.registerUnit({
      call_sign: f.call_sign.trim(), unit_type: f.unit_type,
      station_name: f.station_name.trim(),
      home_lat: Number(f.home_lat), home_lon: Number(f.home_lon),
      crew_size: f.crew_size ? Number(f.crew_size) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] })
      onDone()
    },
    onError: (e: Error) => setError(e.message),
  })

  const valid = f.call_sign && f.station_name &&
    Number.isFinite(Number(f.home_lat)) && f.home_lat !== '' &&
    Number.isFinite(Number(f.home_lon)) && f.home_lon !== ''
  const input = 'bg-ground border border-ground-line rounded-xl px-3 py-2 text-sm'

  return (
    <div className="panel p-4 space-y-3">
      <h3 className="section-label">Register a unit</h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        <input placeholder="Call sign (AMB-07)" value={f.call_sign} className={input}
          onChange={e => setF({ ...f, call_sign: e.target.value })} />
        <select value={f.unit_type} className={input}
          onChange={e => setF({ ...f, unit_type: e.target.value as UnitType })}>
          {TYPES.map(t => <option key={t} value={t}>{UNIT_LABEL[t]}</option>)}
        </select>
        <input placeholder="Station name" value={f.station_name} className={input}
          onChange={e => setF({ ...f, station_name: e.target.value })} />
        <input placeholder="Latitude (5.6581)" value={f.home_lat} className={input}
          onChange={e => setF({ ...f, home_lat: e.target.value })} />
        <input placeholder="Longitude (-0.1812)" value={f.home_lon} className={input}
          onChange={e => setF({ ...f, home_lon: e.target.value })} />
        <input placeholder="Crew size" value={f.crew_size} className={input}
          onChange={e => setF({ ...f, crew_size: e.target.value })} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={!valid || create.isPending} onClick={() => create.mutate()}
          className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white
                     text-sm font-semibold disabled:opacity-40">
          {create.isPending ? 'Saving…' : 'Register'}
        </button>
        <button onClick={onDone}
          className="px-4 py-2 rounded-xl bg-ground text-ink-soft text-sm font-semibold">
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-ink-soft">
        Longitudes in Accra are west, so they are negative (e.g. −0.1812).
      </p>
    </div>
  )
}

function UnitRow({ unit }: { unit: Unit }) {
  const qc = useQueryClient()
  const clear = useMutation({
    mutationFn: () => api.setUnitStatus(unit.call_sign, 'available', 'dispatcher'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
    },
  })
  const busy = ['dispatched', 'en_route', 'on_scene'].includes(unit.status)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-ground-line last:border-0">
      <div className={`icon-tile ${UNIT_TINT[unit.unit_type]}`}>
        <UnitIcon type={unit.unit_type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-ink">{unit.call_sign}</p>
        <p className="text-[11px] text-ink-soft truncate">
          {UNIT_LABEL[unit.unit_type]} · {unit.station_name}
          {unit.crew_size ? ` · crew ${unit.crew_size}` : ''}
        </p>
      </div>
      {unit.assigned_incident_id && (
        <Link to={`/incidents/${unit.assigned_incident_id}`}
          className="text-[11px] font-semibold text-brand-700 hover:underline shrink-0">
          View incident
        </Link>
      )}
      <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold shrink-0 ${
        UNIT_STATUS_STYLE[unit.status]}`}>
        {UNIT_STATUS_LABEL[unit.status]}
      </span>
      {busy && (
        <button onClick={() => clear.mutate()}
          className="px-2.5 py-1.5 rounded-xl bg-ground hover:bg-gray-200 text-ink
                     text-[11px] font-semibold shrink-0">Clear</button>
      )}
    </div>
  )
}

export default function Fleet() {
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<UnitType | 'ALL'>('ALL')

  const { data: units, isLoading } = useQuery({
    queryKey: ['units'], queryFn: api.units, refetchInterval: 20000,
  })
  const { data: page } = useQuery({
    queryKey: ['incidents', 'fleet'],
    queryFn: () => api.incidents({ page_size: 50 }),
  })

  const shown = useMemo(
    () => (units ?? []).filter(u => filter === 'ALL' || u.unit_type === filter),
    [units, filter])

  const counts = useMemo(() => {
    const c = { available: 0, busy: 0, out: 0 }
    for (const u of units ?? []) {
      if (!u.active || u.status === 'out_of_service') c.out++
      else if (u.status === 'available') c.available++
      else c.busy++
    }
    return c
  }, [units])

  const activeIncidents = (page?.items ?? []).filter(
    i => !['resolved', 'false_alarm'].includes(i.status))

  const pins = useMemo(() => [
    ...unitPins(units ?? []),
    ...incidentPins(activeIncidents, () => {}),
  ], [units, activeIncidents])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-5 space-y-4">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Emergency fleet</h2>
            <p className="text-xs text-ink-soft">
              Units the dispatcher can send, and where they are stationed.
            </p>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)}
              className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800
                         text-white text-sm font-semibold">Register unit</button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            ['Available', counts.available, 'text-green-600'],
            ['On a call', counts.busy, 'text-amber-600'],
            ['Out of service', counts.out, 'text-ink-soft'],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="panel p-4">
              <p className="text-[11px] text-ink-soft">{label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${tone}`}>{value as number}</p>
            </div>
          ))}
        </div>

        {adding && <AddUnitForm onDone={() => setAdding(false)} />}

        <div className="panel overflow-hidden">
          <div className="h-[320px]">
            <MapView pins={pins} fitAll zoom={11} />
          </div>
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-ground-line flex-wrap">
            {TYPES.map(t => (
              <span key={t} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: UNIT_COLOR[t] }} />
                {UNIT_LABEL[t]}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
              Active incident
            </span>
          </div>
        </div>

        <div className="panel">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-ground-line flex-wrap">
            <h3 className="section-label flex-1">Units ({shown.length})</h3>
            {(['ALL', ...TYPES] as const).map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  filter === t ? 'bg-brand-700 text-white' : 'bg-ground text-ink-soft hover:text-ink'}`}>
                {t === 'ALL' ? 'All' : UNIT_LABEL[t]}
              </button>
            ))}
          </div>
          {isLoading && <p className="px-4 py-6 text-sm text-ink-soft">Loading…</p>}
          {shown.map(u => <UnitRow key={u.id} unit={u} />)}
          {!isLoading && shown.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-ink-soft">
              No units registered. Use “Register unit”, or run
              <code className="mx-1 px-1.5 py-0.5 rounded bg-ground text-[11px]">
                scripts/register_fleet.py
              </code>
              to load the Accra roster.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
