import { Route, Routes } from 'react-router-dom'
import TopBar from './components/TopBar'
import LiveOps from './screens/LiveOps'
import IncidentDetail from './screens/IncidentDetail'
import Analytics from './screens/Analytics'
import Devices from './screens/Devices'
import Fleet from './screens/Fleet'
import Team from './screens/Team'
import Login from './screens/Login'
import { useAuth } from './lib/auth'
import { LiveProvider } from './lib/live'

export default function App() {
  const { user, restoring } = useAuth()

  // Hold the first paint until the stored refresh token has been tried, so a
  // reload does not flash the login screen at an already-signed-in operator.
  if (restoring) {
    return (
      <div className="h-full flex items-center justify-center bg-ground">
        <div className="flex items-center gap-2.5 text-ink-soft text-sm">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" />
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Restoring session…
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  // The live socket and data queries only mount once there is a session, so
  // nothing ever fires unauthenticated.
  return (
    <LiveProvider>
      <div className="h-full flex flex-col">
        <TopBar />
        <Routes>
          <Route path="/" element={<LiveOps />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/team" element={<Team />} />
        </Routes>
      </div>
    </LiveProvider>
  )
}
