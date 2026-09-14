export function timeAgo(iso: string | null, nowMs?: number): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.floor(((nowMs ?? Date.now()) - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function clock(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function dateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function coords(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return 'no fix'
  return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`
}

export function uptime(s: number | null): string {
  if (s == null) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

export const SEVERITY_COLOR: Record<number, string> = {
  0: '#22c55e', 1: '#f59e0b', 2: '#ef4444',
}

export function severityColor(cls: number | null): string {
  return cls == null ? '#64748b' : SEVERITY_COLOR[cls] ?? '#64748b'
}

/** §7 Screen 2 — label_source rendered in plain English (a thesis finding
 *  made visible).
 *
 *  Note on wording: the gate fires on P(crash) crossing the alert threshold,
 *  which is NOT the same as the model's argmax class — a window can have
 *  model_severity "Normal" while P(crash) still clears the threshold. The
 *  copy below says exactly which of the two triggered, so the panel never
 *  reads "model flagged this (Normal)". */
export function explainLabelSource(inc: {
  label_source: string | null
  peak_g: number | null
  excursion_ms: number | null
  model_severity: string | null
  p_crash: number | null
}, crashThreshold?: number | null): string {
  const pc = inc.p_crash != null ? inc.p_crash.toFixed(3) : '—'
  const thr = crashThreshold != null ? crashThreshold.toFixed(3) : 'the alert threshold'
  switch (inc.label_source) {
    case 'model+signature':
      return `Model and physics signature agreed. The model's crash probability (P(crash) = ${pc}) cleared the alert threshold (${thr}), and the pulse fits the real-crash signature: 2–7 g peak lasting 40–250 ms.`
    case 'signature_override': {
      const peak = inc.peak_g != null ? `${inc.peak_g.toFixed(1)} g` : 'an out-of-band'
      const dur = inc.excursion_ms != null ? `${inc.excursion_ms.toFixed(0)} ms` : 'an atypical duration'
      return `The model's crash probability (P(crash) = ${pc}) cleared the alert threshold (${thr}), but the physics gate rejected it: a ${peak} peak over ${dur} is a manoeuvre or impact artifact, not a crash pulse. Real crashes are 2–7 g lasting 40–250 ms, so this was forced to Normal.`
    }
    case 'model':
      return `The model classified this window as normal driving — P(crash) = ${pc} stayed below the alert threshold (${thr}). No crash detected.`
    case 'manual_panic':
      return 'Manual panic button — a human requested help. The ML model was deliberately bypassed, and this incident is excluded from model-performance statistics.'
    default:
      return inc.label_source ?? 'Classification pending — the ML API was unreachable at ingest and a background retry is queued.'
  }
}

export function csvExport(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
