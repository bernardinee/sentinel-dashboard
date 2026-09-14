// §7 Screen 1 — Live Operations: feed | map | device status.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useLive } from '../lib/live'
import { timeAgo, uptime } from '../lib/format'
import IncidentCard from '../components/IncidentCard'
import MapView, { incidentPins } from '../components/MapView'
import type { Device } from '../lib/types'

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function DeviceRow({ device, nowMs }: { device: Device; nowMs: number }) {
  const { deviceStatus } = useLive()
  const live = deviceStatus[device.device_id]
  const lastSeen = live?.last_seen_at ?? device.last_seen_at
  const ageS = lastSeen ? (nowMs - new Date(lastSeen).getTime()) / 1000 : null
  const online = ageS != null && ageS <= 90
  const sats = live?.satellites ?? device.last_satellites
  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{device.device_id}</span>
        <span className={`flex items-center gap-1.5 text-[11px] font-bold ${
          online ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-400 tabular-nums">
        <span>GPS fix <b className="text-slate-200">{sats != null && sats >= 3 ? 'locked' : 'no'}</b></span>
        <span>sats <b className="text-slate-200">{sats ?? '—'}</b></span>
        <span>uptime <b className="text-slate-200">{uptime(live?.uptime_s ?? device.last_uptime_s)}</b></span>
        <span>RSSI <b className="text-slate-200">{(live?.rssi ?? device.last_rssi) != null ? `${live?.rssi ?? device.last_rssi} dBm` : '—'}</b></span>
        <span>heap <b className="text-slate-200">{live?.free_heap != null ? `${Math.round(live.free_heap / 1024)} kB` : '—'}</b></span>
        <span>fw <b className="text-slate-200">{device.firmware_version ?? '—'}</b></span>
      </div>
      <p className="text-[11px] text-slate-500">
        heartbeat <span className={`font-bold tabular-nums ${
          ageS != null && ageS > 45 ? 'text-amber-400' : 'text-slate-200'}`}>
          {lastSeen ? timeAgo(lastSeen, nowMs) : 'never'}
        </span>
      </p>
    </div>
  )
}

export default function LiveOps() {
  const navigate = useNavigate()
  const nowMs = useNow()
  const { newestIncident } = useLive()

  const { data: page, isLoading } = useQuery({
    queryKey: ['incidents', 'live'],
    queryFn: () => api.incidents({ page_size: 50 }),
    refetchInterval: 60000, // safety net; WS is the primary channel
  })
  const { data: devices } = useQuery({
    queryKey: ['devices'], queryFn: api.devices, refetchInterval: 30000,
  })

  const deviceNames = useMemo(() => {
    const m: Record<string, string> = {}
    devices?.forEach(d => { m[d.id] = d.device_id })
    return m
  }, [devices])

  const incidents = page?.items ?? []
  const pins = useMemo(
    () => incidentPins(incidents, (i) => navigate(`/incidents/${i.id}`)),
    [incidents, navigate])

  const focus = useMemo(() => {
    const target = newestIncident && newestIncident.lat != null ? newestIncident
      : incidents.find(i => i.lat != null)
    return target && target.lat != null && target.lon != null
      ? { lat: target.lat, lon: target.lon, key: target.id } : null
  }, [newestIncident, incidents])

  return (
    // Projector-first: 3 columns on wide screens, device panel folds away below xl.
    <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr_300px]">
      {/* Left: live feed */}
      <section className="border-r border-slate-800 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Incident Feed</h2>
          <span className="text-[11px] text-slate-500 tabular-nums">{page?.total ?? 0} total</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2.5">
          {isLoading && <p className="text-slate-500 text-sm p-2">Loading…</p>}
          {!isLoading && incidents.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-400 font-medium text-sm">No incidents yet</p>
              <p className="text-slate-600 text-xs mt-1">
                Waiting for the first event from the device…
              </p>
            </div>
          )}
          {incidents.map(inc => (
            <IncidentCard key={inc.id} incident={inc}
              deviceName={deviceNames[inc.device_id]} nowMs={nowMs} />
          ))}
        </div>
      </section>

      {/* Centre: map */}
      <section className="relative min-h-0">
        <MapView pins={pins} focus={focus} />
      </section>

      {/* Right: device status (folds away below xl; full detail on /devices) */}
      <section className="hidden xl:flex border-l border-slate-800 flex-col min-h-0">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="font-semibold text-sm">Devices</h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2.5">
          {(devices ?? []).map(d => <DeviceRow key={d.id} device={d} nowMs={nowMs} />)}
          {devices && devices.length === 0 && (
            <p className="text-slate-500 text-xs p-2">
              No devices registered yet. The first POST from the ESP32 registers it automatically.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
