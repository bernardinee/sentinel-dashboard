// §7 Screen 3 — History & Analytics. Every chart reads from the API; nothing
// is hardcoded (§8.1).
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, Legend, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../lib/api'
import { csvExport, dateTime } from '../lib/format'
import SeverityChip from '../components/SeverityChip'
import StatusBadge from '../components/StatusBadge'

const TT = { background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 8, fontSize: 12 }

function Card({ title, sub, children }: {
  title: string; sub?: string; children: React.ReactNode
}) {
  return (
    <div className="panel p-4">
      <h3 className="font-semibold text-sm">{title}</h3>
      {sub && <p className="text-[11px] text-ink-soft mb-2">{sub}</p>}
      {children}
    </div>
  )
}

export default function Analytics() {
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.stats })
  const { data: page } = useQuery({
    queryKey: ['incidents', 'analytics'],
    queryFn: () => api.incidents({ page_size: 500 }),
  })
  const incidents = useMemo(() => (page?.items ?? []).filter(i =>
    (!status || i.status === status) &&
    (severity === '' || String(i.severity_class) === severity)),
    [page, status, severity])

  // detections per day by severity
  const byDay = useMemo(() => {
    const m = new Map<string, { day: string; Normal: number; Moderate: number; Severe: number; pending: number }>()
    for (const i of (page?.items ?? [])) {
      if (i.label_source === 'manual_panic') continue
      const day = i.received_at.slice(0, 10)
      const row = m.get(day) ?? { day, Normal: 0, Moderate: 0, Severe: 0, pending: 0 }
      const key = i.severity_name ?? 'pending'
      row[key as 'Normal'] = (row[key as 'Normal'] ?? 0) + 1
      m.set(day, row)
    }
    return [...m.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-30)
  }, [page])

  const labelSourceData = useMemo(() =>
    Object.entries(stats?.by_label_source ?? {}).map(([name, count]) => ({ name, count })),
    [stats])

  // peak_g histogram, 0.5 g bins. The full 0–12 g range is always emitted
  // (zero-count bins included) so the 2 g and 7 g crash-band markers always
  // have a category to anchor to, and gaps in the data read as real gaps.
  const peakHist = useMemo(() => {
    const bins = new Map<number, number>()
    for (let g = 0; g <= 12; g += 0.5) bins.set(+g.toFixed(1), 0)
    for (const i of (page?.items ?? [])) {
      if (i.peak_g == null || i.label_source === 'manual_panic') continue
      const bin = +Math.min(Math.floor(i.peak_g / 0.5) * 0.5, 12).toFixed(1)
      bins.set(bin, (bins.get(bin) ?? 0) + 1)
    }
    return [...bins.entries()].sort((a, b) => a[0] - b[0])
      .map(([g, count]) => ({ g: g.toFixed(1), gNum: g, count }))
  }, [page])

  // end-to-end latency distribution (detected_at -> received_at)
  const latencyHist = useMemo(() => {
    const bins = new Map<number, number>()
    for (const i of (page?.items ?? [])) {
      if (!i.detected_at) continue
      const s = (new Date(i.received_at).getTime() - new Date(i.detected_at).getTime()) / 1000
      if (s < 0 || s > 60) continue
      const bin = Math.floor(s)
      bins.set(bin, (bins.get(bin) ?? 0) + 1)
    }
    return [...bins.entries()].sort((a, b) => a[0] - b[0])
      .map(([s, count]) => ({ s: `${s}–${s + 1}s`, count }))
  }, [page])

  const exportCsv = () => csvExport(
    incidents.map(i => ({
      event_id: i.event_id, received_at: i.received_at, detected_at: i.detected_at,
      severity: i.severity_name, confidence: i.confidence, p_crash: i.p_crash,
      accident_confirmed: i.accident_confirmed, label_source: i.label_source,
      peak_g: i.peak_g, excursion_ms: i.excursion_ms, impulse_gs: i.impulse_gs,
      lat: i.lat, lon: i.lon, status: i.status,
    })),
    `sentinel-incidents-${new Date().toISOString().slice(0, 10)}.csv`)

  const sel = 'bg-ground border border-ground-line rounded-xl px-2.5 py-1.5 text-xs'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-3 sm:p-5 space-y-3 sm:space-y-4">
        {/* headline stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          {[
            ['Total detections', stats?.total_incidents],
            ['Last 24 h', stats?.last_24h],
            ['Last 7 d', stats?.last_7d],
            ['Mean inference', stats?.mean_inference_ms != null ? `${stats.mean_inference_ms} ms` : '—'],
            ['Mean end-to-end', stats?.mean_end_to_end_s != null ? `${stats.mean_end_to_end_s} s` : '—'],
          ].map(([label, value]) => (
            <div key={label as string} className="panel p-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-soft">{label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{value ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Detections over time" sub="per day, by final severity (panic excluded)">
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={byDay}>
                  <CartesianGrid stroke="#e6e8ec" strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={TT} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Normal" stackId="s" fill="#22c55e" />
                  <Bar dataKey="Moderate" stackId="s" fill="#f59e0b" />
                  <Bar dataKey="Severe" stackId="s" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Label source" sub="how often the physics gate overrode the model — a thesis finding">
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={labelSourceData} layout="vertical">
                  <CartesianGrid stroke="#e6e8ec" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={10} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={130} />
                  <Tooltip contentStyle={TT} />
                  <Bar dataKey="count" fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Peak-g distribution" sub="0.5 g bins · crash band 2–7 g marked">
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={peakHist}>
                  <CartesianGrid stroke="#e6e8ec" strokeDasharray="3 3" />
                  <XAxis dataKey="g" stroke="#9ca3af" fontSize={10} interval={3} />
                  <YAxis stroke="#9ca3af" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={TT} />
                  {/* VZCrash: 99.9% of real crashes fall inside this band */}
                  <ReferenceArea x1="2.0" x2="7.0" fill="#22c55e" fillOpacity={0.08}
                    label={{ value: 'real-crash band', fill: '#4ade80', fontSize: 10, position: 'insideTop' }} />
                  <ReferenceLine x="2.0" stroke="#f59e0b" strokeDasharray="5 4"
                    label={{ value: '2 g', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                  <ReferenceLine x="7.0" stroke="#ef4444" strokeDasharray="5 4"
                    label={{ value: '7 g', fill: '#ef4444', fontSize: 10, position: 'top' }} />
                  <Bar dataKey="count" fill="#a78bfa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="End-to-end latency" sub="device detected_at → server received_at">
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={latencyHist}>
                  <CartesianGrid stroke="#e6e8ec" strokeDasharray="3 3" />
                  <XAxis dataKey="s" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={TT} />
                  <Bar dataKey="count" fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* filterable table */}
        <div className="panel">
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-ground-line flex-wrap">
            <h3 className="font-semibold text-sm flex-1 min-w-full sm:min-w-0">Incident history</h3>
            <select value={severity} onChange={e => setSeverity(e.target.value)} className={sel}>
              <option value="">All severities</option>
              <option value="0">Normal</option>
              <option value="1">Moderate</option>
              <option value="2">Severe</option>
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className={sel}>
              <option value="">All statuses</option>
              {['new', 'acknowledged', 'dispatched', 'resolved', 'false_alarm'].map(s =>
                <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={exportCsv}
              className="px-3 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-xs font-semibold">
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-soft border-b border-ground-line">
                  {['Received', 'Event', 'Severity', 'Conf.', 'Peak g', 'Source', 'Status'].map(h =>
                    <th key={h} className="px-4 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-ground-line">
                {incidents.map(i => (
                  <tr key={i.id} className="hover:bg-ground/40">
                    <td className="px-4 py-2 tabular-nums text-ink-soft">{dateTime(i.received_at)}</td>
                    <td className="px-4 py-2">
                      <Link to={`/incidents/${i.id}`} className="text-sky-400 hover:text-sky-300">
                        {i.event_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <SeverityChip name={i.severity_name} pending={i.classification_pending} />
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {i.confidence != null ? `${(i.confidence * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{i.peak_g?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-2 text-ink-soft">{i.label_source ?? 'pending'}</td>
                    <td className="px-4 py-2"><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
                {incidents.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                    No incidents match the filters.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
