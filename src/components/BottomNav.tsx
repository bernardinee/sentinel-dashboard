// Mobile navigation. A five-item horizontal nav cannot fit a 375px viewport,
// so below `lg` the tabs move to a bottom bar — the same pattern the Sentinel
// mobile app uses, and the reachable half of the screen one-handed.
import { NavLink } from 'react-router-dom'

interface Tab {
  to: string
  label: string
  /** 24×24 path, drawn with currentColor. */
  d: string
}

const TABS: Tab[] = [
  {
    to: '/', label: 'Live',
    d: 'M3 13h4l2.5-6 4 12L16 13h5',
  },
  {
    to: '/fleet', label: 'Fleet',
    d: 'M3 17V7a1 1 0 011-1h9v11H3zm10-7h4l3 3.5V17h-7v-7zM7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  },
  {
    to: '/analytics', label: 'History',
    d: 'M4 20V10m5 10V4m5 16v-7m5 7V7',
  },
  {
    to: '/devices', label: 'Devices',
    d: 'M8 8h8v8H8zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3',
  },
  {
    to: '/team', label: 'Team',
    d: 'M9 11a3 3 0 100-6 3 3 0 000 6zm7 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 20c0-3 2.7-5 6-5s6 2 6 5M16 20c0-2 .8-3.4 2-4.2',
  },
]

export default function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="lg:hidden shrink-0 bg-ground-card border-t border-ground-line
                 grid grid-cols-5
                 pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium
             transition-colors ${isActive ? 'text-brand-700' : 'text-ink-soft'}`}
        >
          {({ isActive }) => (
            <>
              <span className={`flex items-center justify-center w-10 h-6 rounded-lg transition-colors
                                ${isActive ? 'bg-brand-50' : ''}`}>
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none"
                  stroke="currentColor" strokeWidth="1.9"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d={tab.d} />
                </svg>
              </span>
              {tab.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
