import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useLive } from '../lib/live'

const WS_LABEL = {
  connected: { text: 'LIVE', cls: 'text-emerald-400', dot: 'bg-emerald-500' },
  connecting: { text: 'CONNECTING', cls: 'text-amber-400', dot: 'bg-amber-500' },
  reconnecting: { text: 'RECONNECTING', cls: 'text-red-400', dot: 'bg-red-500 animate-pulse' },
}

const NAV = [
  { to: '/', label: 'Live Ops' },
  { to: '/analytics', label: 'History & Analytics' },
  { to: '/devices', label: 'Devices' },
]

export default function TopBar() {
  const { wsState } = useLive()
  const ws = WS_LABEL[wsState]
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.stats,
    refetchInterval: 30000 })
  const { data: ml } = useQuery({ queryKey: ['mlHealth'], queryFn: api.mlHealth,
    refetchInterval: 60000 })
  const { data: active } = useQuery({ queryKey: ['incidents', 'activeCount'],
    queryFn: () => api.incidents({ page_size: 1 }), enabled: false })
  void active

  const mlOk = ml?.status === 'healthy'

  return (
    <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4 whitespace-nowrap overflow-hidden">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-red-700 flex items-center justify-center font-black text-white shrink-0">S</div>
        <div className="leading-tight hidden sm:block">
          <p className="font-bold tracking-wide">SENTINEL</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Accident Response Console</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 shrink-0">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) =>
              `px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                isActive ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-4 text-xs shrink-0">
        <div className="flex items-center gap-1.5 shrink-0" title="WebSocket connection">
          <span className={`w-2 h-2 rounded-full ${ws.dot}`} />
          <span className={`font-bold ${ws.cls}`}>{ws.text}</span>
        </div>
        <div className="text-slate-400 hidden md:block shrink-0">
          Today <span className="font-bold text-slate-100 tabular-nums">{stats?.last_24h ?? '—'}</span>
        </div>
        <div className="text-slate-400 hidden md:block shrink-0">
          Unresolved <span className="font-bold text-red-400 tabular-nums">
            {stats ? (stats.by_status['new'] ?? 0) + (stats.by_status['acknowledged'] ?? 0) + (stats.by_status['dispatched'] ?? 0) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0"
          title={mlOk ? `${ml?.model} · ${ml?.taxonomy} · thr ${ml?.crash_alert_threshold}` : ml?.error ?? 'ML API unreachable'}>
          <span className={`w-2 h-2 rounded-full ${mlOk ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-slate-400 hidden lg:inline">ML API {mlOk ? `OK (${ml?.mode})` : 'DOWN'}</span>
          <span className="text-slate-400 lg:hidden">ML</span>
        </div>
      </div>
    </header>
  )
}
