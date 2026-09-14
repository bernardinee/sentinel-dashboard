import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useLive } from '../lib/live'

const WS_LABEL = {
  connected: { text: 'Live', cls: 'text-green-600', dot: 'bg-green-500' },
  connecting: { text: 'Connecting', cls: 'text-amber-600', dot: 'bg-amber-500' },
  reconnecting: { text: 'Reconnecting', cls: 'text-red-600', dot: 'bg-red-500 animate-pulse' },
}

const NAV = [
  { to: '/', label: 'Live Ops' },
  { to: '/fleet', label: 'Fleet' },
  { to: '/analytics', label: 'History' },
  { to: '/devices', label: 'Devices' },
]

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="hidden md:flex flex-col items-end leading-tight shrink-0">
      <span className={`text-sm font-bold tabular-nums ${tone ?? 'text-ink'}`}>{value}</span>
      <span className="text-[10px] text-ink-soft">{label}</span>
    </div>
  )
}

export default function TopBar() {
  const { wsState } = useLive()
  const ws = WS_LABEL[wsState]
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 30000 })
  const { data: ml } = useQuery({ queryKey: ['mlHealth'], queryFn: api.mlHealth, refetchInterval: 60000 })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: api.units, refetchInterval: 30000 })

  const mlOk = ml?.status === 'healthy'
  const unresolved = stats
    ? (stats.by_status['new'] ?? 0) + (stats.by_status['acknowledged'] ?? 0) +
      (stats.by_status['dispatched'] ?? 0)
    : '—'
  const available = units?.filter(u => u.status === 'available' && u.active).length

  return (
    <header className="h-16 shrink-0 bg-ground-card border-b border-ground-line
                       flex items-center px-4 gap-4 whitespace-nowrap overflow-hidden">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
            <path d="M12 2l8 3v6c0 5-3.4 9.1-8 11-4.6-1.9-8-6-8-11V5l8-3z" opacity=".95" />
            <path d="M11 8h2v3h3v2h-3v3h-2v-3H8v-2h3V8z" fill="#0d7360" />
          </svg>
        </div>
        <div className="leading-tight hidden sm:block">
          <p className="font-bold text-[15px] text-ink">Sentinel</p>
          <p className="text-[10px] text-ink-soft">Dispatch console</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 shrink-0">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-soft hover:text-ink hover:bg-ground'}`}>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-5 shrink-0">
        <Metric label="Today" value={stats?.last_24h ?? '—'} />
        <Metric label="Unresolved" value={unresolved}
          tone={typeof unresolved === 'number' && unresolved > 0 ? 'text-red-600' : undefined} />
        <Metric label="Units free" value={available ?? '—'} tone="text-brand-700" />

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-ground shrink-0"
          title="WebSocket connection">
          <span className={`w-2 h-2 rounded-full ${ws.dot}`} />
          <span className={`text-xs font-semibold ${ws.cls}`}>{ws.text}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0"
          title={mlOk ? `${ml?.model} · ${ml?.taxonomy} · threshold ${ml?.crash_alert_threshold}`
                      : ml?.error ?? 'ML API unreachable'}>
          <span className={`w-2 h-2 rounded-full ${mlOk ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-xs text-ink-soft hidden lg:inline">
            ML {mlOk ? `ready (${ml?.mode})` : 'down'}
          </span>
        </div>
      </div>
    </header>
  )
}
