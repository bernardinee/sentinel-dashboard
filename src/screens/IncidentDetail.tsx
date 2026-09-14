// §7 Screen 2 — Incident Detail. The waveform is the centrepiece; the
// classification panel explains WHY the label came out as it did.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  clock, coords, dateTime, explainLabelSource, severityColor,
} from '../lib/format'
import SeverityChip from '../components/SeverityChip'
import StatusBadge from '../components/StatusBadge'
import WaveformChart from '../components/WaveformChart'
import MapView from '../components/MapView'
import type { IncidentDetail as IncidentDetailT } from '../lib/types'

const ACTOR_KEY = 'sentinel.actor'

function SignatureRow({ label, value, test, pass }: {
  label: string
  value: string
  test: string
  pass: boolean | null
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <div>
        <p className="text-xs text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-500">{test}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tabular-nums">{value}</span>
        {pass != null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            pass ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
            {pass ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
    </div>
  )
}

function ActionBar({ incident }: { incident: IncidentDetailT }) {
  const qc = useQueryClient()
  const [actor, setActor] = useState(() => localStorage.getItem(ACTOR_KEY) ?? 'operator')
  const [error, setError] = useState('')

  const mutate = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      setError('')
      qc.invalidateQueries({ queryKey: ['incident', incident.id] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const act = (fn: () => Promise<unknown>) => {
    localStorage.setItem(ACTOR_KEY, actor)
    mutate.mutate(fn)
  }
  const open = !['resolved', 'false_alarm'].includes(incident.status)
  const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-slate-500">Actor</label>
        <input value={actor} onChange={e => setActor(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs w-36" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={incident.status !== 'new' || mutate.isPending}
          onClick={() => act(() => api.acknowledge(incident.id, actor))}
          className={`${btn} bg-sky-700 hover:bg-sky-600 text-white`}>Acknowledge</button>
        <button disabled={!['acknowledged', 'dispatched'].includes(incident.status) || mutate.isPending}
          onClick={() => act(() => api.dispatch(incident.id, actor, 'en_route'))}
          className={`${btn} bg-indigo-700 hover:bg-indigo-600 text-white`}>En route</button>
        <button disabled={incident.status !== 'dispatched' || mutate.isPending}
          onClick={() => act(() => api.dispatch(incident.id, actor, 'on_scene'))}
          className={`${btn} bg-indigo-800 hover:bg-indigo-700 text-white`}>On scene</button>
        <button disabled={!open || mutate.isPending}
          onClick={() => act(() => api.resolve(incident.id, actor, 'resolved'))}
          className={`${btn} bg-emerald-700 hover:bg-emerald-600 text-white`}>Resolve</button>
        <button disabled={!open || mutate.isPending}
          onClick={() => act(() => api.resolve(incident.id, actor, 'false_alarm'))}
          className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-100`}>False alarm</button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}

export default function IncidentDetail() {
  const { id = '' } = useParams()
  const { data: incident } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => api.incident(id),
  })
  const { data: window } = useQuery({
    queryKey: ['incident', id, 'window'],
    queryFn: () => api.incidentWindow(id),
    enabled: !!incident,
    staleTime: Infinity, // stored evidence never changes
  })
  // The alert threshold is model metadata, not per-incident — read it from
  // /ml/health so the explanation quotes the real number.
  const { data: ml } = useQuery({ queryKey: ['mlHealth'], queryFn: api.mlHealth })

  if (!incident) return <div className="p-8 text-slate-500">Loading incident…</div>

  const probs = incident.probabilities ?? {}
  const isPanic = incident.label_source === 'manual_panic'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-5 space-y-4">
        {/* header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm">← Live Ops</Link>
            <h1 className="font-bold">{incident.event_id}</h1>
            <SeverityChip name={incident.severity_name} pending={incident.classification_pending} big />
            <StatusBadge status={incident.status} />
          </div>
          <p className="text-xs text-slate-500">received {dateTime(incident.received_at)}</p>
        </div>

        {/* waveform centrepiece */}
        {window
          ? <WaveformChart window={window} />
          : <div className="panel p-8 text-center text-slate-500 text-sm">Loading stored window…</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* crash signature panel */}
          <div className="panel p-4">
            <h3 className="font-semibold text-sm">Crash signature (physics gate)</h3>
            <p className="text-[10px] text-slate-500 mb-2">measured on the 20 Hz low-passed window</p>
            {isPanic ? (
              <p className="text-xs text-slate-400">Not applicable — manual panic bypasses the model.</p>
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
                  <span className="text-xs text-slate-300">Signature match</span>
                  <span className={`text-xs font-bold ${
                    incident.signature_match ? 'text-emerald-400' : 'text-red-400'}`}>
                    {incident.signature_match == null ? '—' : incident.signature_match ? 'YES' : 'NO'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* classification panel */}
          <div className="panel p-4">
            <h3 className="font-semibold text-sm mb-2">Classification</h3>
            <div className="space-y-1.5 text-xs">
              {(['Normal', 'Moderate', 'Severe'] as const).map((name, i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-16 text-slate-400">{name}</span>
                  <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${((probs[name] ?? 0) * 100).toFixed(1)}%`,
                        backgroundColor: severityColor(i) }} />
                  </div>
                  <span className="w-12 text-right tabular-nums text-slate-300">
                    {((probs[name] ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mt-3 text-slate-400 tabular-nums">
              <span>P(crash) <b className="text-slate-200">{incident.p_crash != null ? incident.p_crash.toFixed(3) : '—'}</b></span>
              <span>confidence <b className="text-slate-200">{incident.confidence != null ? `${(incident.confidence * 100).toFixed(1)}%` : '—'}</b></span>
              <span>model said <b className="text-slate-200">{incident.model_severity ?? '—'}</b></span>
              <span>final <b className="text-slate-200">{incident.severity_name ?? 'pending'}</b></span>
            </div>
            <div className="mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Why · label_source = {incident.label_source ?? 'pending'}
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                {explainLabelSource(incident, ml?.crash_alert_threshold)}
              </p>
            </div>
          </div>

          {/* location + latency */}
          <div className="space-y-4">
            <div className="panel overflow-hidden">
              <div className="h-40">
                {incident.lat != null && incident.lon != null ? (
                  <MapView zoom={14}
                    pins={[{ id: incident.id, lat: incident.lat, lon: incident.lon,
                      color: severityColor(incident.severity_class),
                      label: incident.severity_name ?? 'Incident' }]}
                    focus={{ lat: incident.lat, lon: incident.lon, key: incident.id }} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No GPS fix for this incident
                  </div>
                )}
              </div>
              <div className="p-3 flex items-center justify-between text-xs">
                <span className="text-slate-400 tabular-nums">{coords(incident.lat, incident.lon)}
                  {incident.satellites != null && ` · ${incident.satellites} sats`}</span>
                {incident.lat != null && (
                  <a className="text-sky-400 hover:text-sky-300 font-medium"
                    href={`https://maps.google.com/?q=${incident.lat},${incident.lon}`}
                    target="_blank" rel="noreferrer">Google Maps ↗</a>
                )}
              </div>
            </div>

            <div className="panel p-4">
              <h3 className="font-semibold text-sm mb-2">Latency breakdown</h3>
              <div className="space-y-1 text-xs text-slate-400 tabular-nums">
                <div className="flex justify-between"><span>detected (device)</span>
                  <b className="text-slate-200">{clock(incident.detected_at)}</b></div>
                <div className="flex justify-between"><span>received (server)</span>
                  <b className="text-slate-200">{clock(incident.received_at)}</b></div>
                <div className="flex justify-between"><span>uplink + queue</span>
                  <b className="text-slate-200">
                    {incident.detected_at
                      ? `${((new Date(incident.received_at).getTime() - new Date(incident.detected_at).getTime()) / 1000).toFixed(2)} s`
                      : '—'}
                  </b></div>
                <div className="flex justify-between"><span>inference</span>
                  <b className="text-slate-200">
                    {incident.inference_time_ms != null ? `${incident.inference_time_ms.toFixed(1)} ms` : '—'}
                  </b></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActionBar incident={incident} />

          {/* dispatch timeline — derived from dispatch_events (§5.3) */}
          <div className="panel p-4">
            <h3 className="font-semibold text-sm mb-3">Mission timeline</h3>
            {incident.dispatch_events.length === 0 ? (
              <p className="text-xs text-slate-500">No actions yet.</p>
            ) : (
              <ol className="space-y-2">
                {incident.dispatch_events.map(e => (
                  <li key={e.id} className="flex gap-3 text-xs">
                    <span className="text-slate-500 tabular-nums shrink-0 w-20">{clock(e.at)}</span>
                    <span className="w-2 h-2 rounded-full bg-sky-500 mt-1 shrink-0" />
                    <span className="text-slate-300">
                      <b className="text-slate-100">{e.action.replace('_', ' ')}</b> by {e.actor}
                      {e.note && <span className="text-slate-500"> — {e.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
