// Incident Detail. The waveform is the centrepiece; the classification panel
// explains WHY the label came out as it did; the dispatch panel sends units.
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  clock, coords, dateTime, explainLabelSource, severityColor,
} from '../lib/format'
import { UNIT_COLOR } from '../lib/units'
import SeverityChip from '../components/SeverityChip'
import StatusBadge from '../components/StatusBadge'
import WaveformChart from '../components/WaveformChart'
import MapView from '../components/MapView'
import DispatchPanel from '../components/DispatchPanel'
import type { DispatchOption, IncidentDetail as IncidentDetailT } from '../lib/types'

const ACTOR_KEY = 'sentinel.actor'

function SignatureRow({ label, value, test, pass }: {
  label: string; value: string; test: string; pass: boolean | null
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-ground-line last:border-0">
      <div>
        <p className="text-xs text-ink font-medium">{label}</p>
        <p className="text-[10px] text-ink-soft">{test}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tabular-nums text-ink">{value}</span>
        {pass != null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            pass ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {pass ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
    </div>
  )
}

function ActionBar({ incident, actor, setActor }: {
  incident: IncidentDetailT; actor: string; setActor: (a: string) => void
}) {
  const qc = useQueryClient()
  const [error, setError] = useState('')

  const mutate = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      setError('')
      qc.invalidateQueries({ queryKey: ['incident', incident.id] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['units'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const act = (fn: () => Promise<unknown>) => {
    localStorage.setItem(ACTOR_KEY, actor)
    mutate.mutate(fn)
  }
  const open = !['resolved', 'false_alarm'].includes(incident.status)
  const btn = 'px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-ink-soft">Operator</label>
        <input value={actor} onChange={e => setActor(e.target.value)}
          className="bg-ground border border-ground-line rounded-xl px-2.5 py-1.5 text-xs w-36" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={incident.status !== 'new' || mutate.isPending}
          onClick={() => act(() => api.acknowledge(incident.id, actor))}
          className={`${btn} bg-sky-600 hover:bg-sky-700 text-white`}>Acknowledge</button>
        <button disabled={!open || mutate.isPending}
          onClick={() => act(() => api.resolve(incident.id, actor, 'resolved'))}
          className={`${btn} bg-green-600 hover:bg-green-700 text-white`}>Resolve</button>
        <button disabled={!open || mutate.isPending}
          onClick={() => act(() => api.resolve(incident.id, actor, 'false_alarm'))}
          className={`${btn} bg-ground hover:bg-gray-200 text-ink`}>False alarm</button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

export default function IncidentDetail() {
  const { id = '' } = useParams()
  const [actor, setActor] = useState(() => localStorage.getItem(ACTOR_KEY) ?? 'dispatcher')
  const [preview, setPreview] = useState<DispatchOption | null>(null)

  const { data: incident } = useQuery({
    queryKey: ['incident', id], queryFn: () => api.incident(id),
  })
  const { data: window } = useQuery({
    queryKey: ['incident', id, 'window'], queryFn: () => api.incidentWindow(id),
    enabled: !!incident, staleTime: Infinity,   // stored evidence never changes
  })
  // The alert threshold is model metadata, not per-incident — read it from
  // /ml/health so the explanation quotes the real number.
  const { data: ml } = useQuery({ queryKey: ['mlHealth'], queryFn: api.mlHealth })
  // DispatchPanel owns the units list; the map reads routes from dispatchOptions.
  const { data: options } = useQuery({
    queryKey: ['dispatchOptions', id],
    queryFn: () => api.dispatchOptions(id),
    enabled: !!incident?.lat,
  })

  // Draw the hovered candidate's route, else the routes of units already sent.
  const { pins, routes } = useMemo(() => {
    if (!incident || incident.lat == null || incident.lon == null) {
      return { pins: [], routes: [] }
    }
    const scene = {
      id: 'scene', lat: incident.lat, lon: incident.lon,
      color: severityColor(incident.severity_class),
      label: incident.severity_name ?? 'Incident', sub: incident.event_id,
      kind: 'incident' as const,
    }
    if (preview) {
      const u = preview.unit
      return {
        pins: [scene, {
          id: `u-${u.id}`, lat: u.current_lat ?? u.home_lat, lon: u.current_lon ?? u.home_lon,
          color: UNIT_COLOR[u.unit_type], label: u.call_sign, sub: u.station_name,
          kind: 'unit' as const, glyph: u.unit_type.slice(0, 2),
        }],
        routes: [{
          geometry: preview.route.geometry,
          color: UNIT_COLOR[u.unit_type],
          dashed: preview.route.source !== 'osrm',
        }],
      }
    }
    // Nothing hovered: show the units actually responding, and their routes.
    const responding = options?.responding ?? []
    const respondingPins = responding.map(o => ({
      id: `u-${o.unit.id}`,
      lat: o.unit.current_lat ?? o.unit.home_lat,
      lon: o.unit.current_lon ?? o.unit.home_lon,
      color: UNIT_COLOR[o.unit.unit_type], label: o.unit.call_sign,
      sub: `${o.unit.station_name} — ETA ${o.eta_min.toFixed(0)} min`,
      kind: 'unit' as const, glyph: o.unit.unit_type.slice(0, 2),
    }))
    const respondingRoutes = responding.map(o => ({
      geometry: o.route.geometry,
      color: UNIT_COLOR[o.unit.unit_type],
      dashed: o.route.source !== 'osrm',
    }))
    return { pins: [scene, ...respondingPins], routes: respondingRoutes }
  }, [incident, preview, options])

  if (!incident) return <div className="p-8 text-ink-soft">Loading incident…</div>

  const probs = incident.probabilities ?? {}
  const isPanic = incident.label_source === 'manual_panic'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-ground">
      <div className="max-w-6xl mx-auto p-5 space-y-4">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-ink-soft hover:text-ink text-sm">← Live Ops</Link>
            <h1 className="font-bold text-ink">{incident.event_id}</h1>
            <SeverityChip name={incident.severity_name} pending={incident.classification_pending} big />
            <StatusBadge status={incident.status} />
          </div>
          <p className="text-xs text-ink-soft">received {dateTime(incident.received_at)}</p>
        </div>

        {window
          ? <WaveformChart window={window} />
          : <div className="panel p-8 text-center text-ink-soft text-sm">Loading stored window…</div>}

        {/* Dispatch: map with the live route, beside the ranked unit list */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="panel overflow-hidden">
            <div className="h-[360px]">
              {incident.lat != null && incident.lon != null ? (
                <MapView pins={pins} routes={routes} zoom={13}
                  focus={routes.length === 0
                    ? { lat: incident.lat, lon: incident.lon, key: incident.id }
                    : null} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-ink-soft">
                  No GPS fix for this incident
                </div>
              )}
            </div>
            <div className="p-3 flex items-center justify-between text-xs border-t border-ground-line">
              <span className="text-ink-soft tabular-nums">
                {coords(incident.lat, incident.lon)}
                {incident.satellites != null && ` · ${incident.satellites} sats`}
              </span>
              {incident.lat != null && (
                <a className="text-brand-700 hover:underline font-semibold"
                  href={`https://maps.google.com/?q=${incident.lat},${incident.lon}`}
                  target="_blank" rel="noreferrer">Open in Maps ↗</a>
              )}
            </div>
          </div>

          <DispatchPanel incident={incident} actor={actor} onPreview={setPreview} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="panel p-4">
            <h3 className="section-label">Crash signature (physics gate)</h3>
            <p className="text-[10px] text-ink-soft mb-1">measured on the 20 Hz low-passed window</p>
            {isPanic ? (
              <p className="text-xs text-ink-soft py-2">
                Not applicable — manual panic bypasses the model.
              </p>
            ) : (
              <>
                <SignatureRow label="Peak resultant" test="crash band: 2 g ≤ peak < 7 g"
                  value={incident.peak_g != null ? `${incident.peak_g.toFixed(2)} g` : '—'}
                  pass={incident.peak_g != null ? incident.peak_g >= 2 && incident.peak_g < 7 : null} />
                <SignatureRow label="Excursion above 2 g" test="transient: 40–250 ms"
                  value={incident.excursion_ms != null ? `${incident.excursion_ms.toFixed(0)} ms` : '—'}
                  pass={incident.excursion_ms != null
                    ? incident.excursion_ms >= 40 && incident.excursion_ms <= 250 : null} />
                <SignatureRow label="Impulse (Δv proxy)" test="Severe if ≥ 0.959 g·s (~34 km/h)"
                  value={incident.impulse_gs != null ? `${incident.impulse_gs.toFixed(3)} g·s` : '—'}
                  pass={null} />
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-ink font-medium">Signature match</span>
                  <span className={`text-xs font-bold ${
                    incident.signature_match ? 'text-green-600' : 'text-red-600'}`}>
                    {incident.signature_match == null ? '—' : incident.signature_match ? 'YES' : 'NO'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="panel p-4">
            <h3 className="section-label mb-2">Classification</h3>
            <div className="space-y-1.5 text-xs">
              {(['Normal', 'Moderate', 'Severe'] as const).map((name, i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-16 text-ink-soft">{name}</span>
                  <div className="flex-1 h-2.5 bg-ground rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${((probs[name] ?? 0) * 100).toFixed(1)}%`,
                        backgroundColor: severityColor(i) }} />
                  </div>
                  <span className="w-12 text-right tabular-nums text-ink">
                    {((probs[name] ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mt-3 text-ink-soft tabular-nums">
              <span>P(crash) <b className="text-ink">{incident.p_crash?.toFixed(3) ?? '—'}</b></span>
              <span>confidence <b className="text-ink">
                {incident.confidence != null ? `${(incident.confidence * 100).toFixed(1)}%` : '—'}</b></span>
              <span>model said <b className="text-ink">{incident.model_severity ?? '—'}</b></span>
              <span>final <b className="text-ink">{incident.severity_name ?? 'pending'}</b></span>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-ground">
              <p className="text-[10px] uppercase tracking-wide text-ink-soft mb-1">
                Why · label_source = {incident.label_source ?? 'pending'}
              </p>
              <p className="text-xs text-ink leading-relaxed">
                {explainLabelSource(incident, ml?.crash_alert_threshold)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel p-4">
              <h3 className="section-label mb-2">Latency breakdown</h3>
              <div className="space-y-1.5 text-xs text-ink-soft tabular-nums">
                <div className="flex justify-between"><span>detected (device)</span>
                  <b className="text-ink">{clock(incident.detected_at)}</b></div>
                <div className="flex justify-between"><span>received (server)</span>
                  <b className="text-ink">{clock(incident.received_at)}</b></div>
                <div className="flex justify-between"><span>uplink + queue</span>
                  <b className="text-ink">
                    {incident.detected_at
                      ? `${((new Date(incident.received_at).getTime() -
                            new Date(incident.detected_at).getTime()) / 1000).toFixed(2)} s`
                      : '—'}
                  </b></div>
                <div className="flex justify-between"><span>inference</span>
                  <b className="text-ink">
                    {incident.inference_time_ms != null
                      ? `${incident.inference_time_ms.toFixed(1)} ms` : '—'}
                  </b></div>
              </div>
            </div>
            <ActionBar incident={incident} actor={actor} setActor={setActor} />
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="section-label mb-3">Mission timeline</h3>
          {incident.dispatch_events.length === 0 ? (
            <p className="text-xs text-ink-soft">No actions yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {incident.dispatch_events.map(e => (
                <li key={e.id} className="flex gap-3 text-xs">
                  <span className="text-ink-soft tabular-nums shrink-0 w-20">{clock(e.at)}</span>
                  <span className="w-2 h-2 rounded-full bg-brand-500 mt-1 shrink-0" />
                  <span className="text-ink">
                    <b>{e.action.replace('_', ' ')}</b> by {e.actor}
                    {e.note && <span className="text-ink-soft"> — {e.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
