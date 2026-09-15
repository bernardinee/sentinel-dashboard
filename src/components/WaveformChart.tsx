// §7 Screen 2 centrepiece: the captured 500-sample window, rendered from
// stored data. Resultant magnitude with the 2 g threshold line, the excursion
// window shaded, and the peak annotated; per-axis toggle.
import { useMemo, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { IncidentWindow } from '../lib/types'

const THRESHOLD_G = 2.0

interface Row {
  t: number
  mag: number
  ax: number
  ay: number
  az: number
}

function excursionBounds(mag: number[]): { start: number; end: number } | null {
  // longest run >= 2 g — mirrors the backend crash_signature computation
  let best: [number, number] | null = null
  let runStart = -1
  for (let i = 0; i <= mag.length; i++) {
    const above = i < mag.length && mag[i] >= THRESHOLD_G
    if (above && runStart < 0) runStart = i
    if (!above && runStart >= 0) {
      if (!best || i - runStart > best[1] - best[0]) best = [runStart, i - 1]
      runStart = -1
    }
  }
  return best ? { start: best[0], end: best[1] } : null
}

export default function WaveformChart({ window: w }: { window: IncidentWindow }) {
  const [mode, setMode] = useState<'magnitude' | 'axes'>('magnitude')

  const { rows, peak, excursion } = useMemo(() => {
    const mag = w.ax.map((x, i) =>
      Math.sqrt(x * x + w.ay[i] * w.ay[i] + w.az[i] * w.az[i]))
    const rows: Row[] = mag.map((m, i) => ({
      t: +(i * (1000 / w.fs_hz) / 1000).toFixed(2),
      mag: +m.toFixed(3),
      ax: +w.ax[i].toFixed(3), ay: +w.ay[i].toFixed(3), az: +w.az[i].toFixed(3),
    }))
    const peakIdx = mag.indexOf(Math.max(...mag))
    return {
      rows,
      peak: { t: rows[peakIdx].t, g: mag[peakIdx] },
      excursion: excursionBounds(mag),
    }
  }, [w])

  return (
    <div className="panel p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div>
          <h3 className="font-semibold text-sm">Captured IMU window</h3>
          <p className="text-xs text-ink-soft">
            {w.ax.length} samples @ {w.fs_hz} Hz · impact-centred · raw stored samples, unfiltered
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-ground-line text-xs shrink-0 self-start">
          {(['magnitude', 'axes'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 font-medium whitespace-nowrap ${mode === m
                ? 'bg-brand-700 text-ink' : 'bg-ground-card text-ink-soft hover:text-ink'}`}>
              {m === 'magnitude' ? 'Resultant |a|' : 'Per-axis'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-52 sm:h-72">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="#e6e8ec" strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke="#9ca3af" fontSize={11} interval={49} tickMargin={4}
              label={{ value: 'time (s)', position: 'insideBottomRight', offset: -2, fill: '#6b7280', fontSize: 11 }} />
            <YAxis stroke="#9ca3af" fontSize={11}
              label={{ value: 'g', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(t) => `t = ${t} s`} />
            {mode === 'magnitude' && excursion && (
              <ReferenceArea x1={rows[excursion.start].t} x2={rows[excursion.end].t}
                fill="#ef4444" fillOpacity={0.12}
                label={{ value: 'excursion ≥2g', position: 'insideTop', fill: '#f87171', fontSize: 10 }} />
            )}
            <ReferenceLine y={THRESHOLD_G} stroke="#f59e0b" strokeDasharray="6 4"
              label={{ value: '2 g threshold', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
            {mode === 'magnitude' ? (
              <>
                <Line dataKey="mag" name="|a|" stroke="#38bdf8" dot={false} strokeWidth={1.6} isAnimationActive={false} />
                <ReferenceDot x={peak.t} y={+peak.g.toFixed(3)} r={4} fill="#ef4444" stroke="#fff"
                  label={{ value: `raw peak ${peak.g.toFixed(2)} g`, position: 'top', fill: '#f87171', fontSize: 11 }} />
              </>
            ) : (
              <>
                <Line dataKey="ax" stroke="#38bdf8" dot={false} strokeWidth={1.2} isAnimationActive={false} />
                <Line dataKey="ay" stroke="#a78bfa" dot={false} strokeWidth={1.2} isAnimationActive={false} />
                <Line dataKey="az" stroke="#34d399" dot={false} strokeWidth={1.2} isAnimationActive={false} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {mode === 'axes' && (
        <div className="flex gap-4 text-[11px] text-ink-soft mt-1">
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#38bdf8' }} />ax</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#a78bfa' }} />ay</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#34d399' }} />az</span>
        </div>
      )}
      <p className="text-[10px] text-ink-soft mt-2 leading-relaxed">
        This plot is the raw window as captured. The crash-signature figures beside it are
        computed on the same window after a zero-phase 20 Hz low-pass filter, applied to match
        the model's training pipeline — so the filtered peak can differ slightly from the raw
        peak shown here (filtfilt overshoots on very sharp transients).
      </p>
    </div>
  )
}
