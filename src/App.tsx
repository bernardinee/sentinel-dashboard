import { Route, Routes } from 'react-router-dom'
import TopBar from './components/TopBar'
import LiveOps from './screens/LiveOps'
import IncidentDetail from './screens/IncidentDetail'
import Analytics from './screens/Analytics'
import Devices from './screens/Devices'
import Fleet from './screens/Fleet'

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <Routes>
        <Route path="/" element={<LiveOps />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/devices" element={<Devices />} />
      </Routes>
    </div>
  )
}
