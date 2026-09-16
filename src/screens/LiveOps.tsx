// Live Operations: feed | map | device + fleet status.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useLive } from '../lib/live'
import { hasFix, timeAgo, uptime } from '../lib/format'
import { UNIT_COLOR, UNIT_LABEL, UNIT_STATUS_LABEL, UNIT_STATUS_STYLE } from '../lib/units'
import IncidentCard from '../components/IncidentCard'
import MapView, { incidentPins, unitPins } from '../components/MapView'
import type { Device } from '../lib/types'

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function Check({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none"
        stroke="currentColor" strokeWidth={3.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="w-5 h-5 rounded-full bg-gray-300 shrink-0" />
  )
}

function DeviceCard({ device, nowMs }: { device: Device; nowMs: number }) {
  const { deviceStatus } = useLive()
  const live = deviceStatus[device.device_id]
  const lastSeen = live?.last_seen_at ?? device.last_seen_at
  const ageS = lastSeen ? (nowMs - new Date(lastSeen).getTime()) / 1000 : null
  const online = ageS != null && ageS <= 90
  const sats = live?.satellites ?? device.last_satellites
  const gpsLocked = (sats ?? 0) >= 3

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-ink">{device.device_id}</span>
        <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${
          online ? 'text-green-600' : 'text-red-600'}`}>
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="space-y-2">
        {[
          ['Location available', gpsLocked ? `${sats} satellites` : 'no fix', gpsLocked],
          ['Monitoring active', online ? 'crash detection ready' : 'device unreachable', online],
        ].map(([title, sub, ok]) => (
          <div key={title as string} className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink">{title as string}</p>
              <p className="text-[11px] text-ink-soft truncate">{sub as string}</p>
            </div>
            <Check ok={ok as boolean} />
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-ground-line grid grid-cols-2 gap-y-1 text-[11px] text-ink-soft tabular-nums">
        <span>Last check</span>
        <span className={`text-right font-semibold ${
          ageS != null && ageS > 45 ? 'text-amber-600' : 'text-ink'}`}>
          {lastSeen ? timeAgo(lastSeen, nowMs) : 'never'}
        </span>
        <span>Uptime</span>
        <span className="text-right font-semibold text-ink">
          {uptime(live?.uptime_s ?? device.last_uptime_s)}
        </span>
      </div>
    </div>
  )
}

export default function LiveOps() {
  const navigate = useNavigate()
  const nowMs = useNow()
  // Mobile-only switch; ignored from lg upwards, where both panes are visible.
  const [view, setView] = useState<'feed' | 'map'>('feed')
  const { newestIncident } = useLive()

  const { data: page, isLoading } = useQuery({
    queryKey: ['incidents', 'live'],
    queryFn: () => api.incidents({ page_size: 50 }),
    refetchInterval: 60000,      // safety net; the WebSocket is the primary channel
  })
  const { data: devices } = useQuery({
    queryKey: ['devices'], queryFn: api.devices, refetchInterval: 30000,
  })
  const { data: units } = useQuery({
    queryKey: ['units'], queryFn: api.units, refetchInterval: 20000,
  })

  const deviceNames = useMemo(() => {
    const m: Record<string, string> = {}
    devices?.forEach(d => { m[d.id] = d.device_id })
    return m
  }, [devices])

  const unitsByIncident = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const u of units ?? []) {
      if (u.assigned_incident_id) {
        (m[u.assigned_incident_id] ??= []).push(u.call_sign)
      }
    }
    return m
  }, [units])

  const incidents = page?.items ?? []
  const activeIncidents = incidents.filter(i => !['resolved', 'false_alarm'].includes(i.status))

  const pins = useMemo(() => [
    ...unitPins(units ?? []),
    ...incidentPins(incidents, (i) => navigate(`/incidents/${i.id}`)),
  ], [incidents, units, navigate])

  const focus = useMemo(() => {
    const target = newestIncident && hasFix(newestIncident.lat, newestIncident.lon)
      ? newestIncident
      : incidents.find(i => hasFix(i.lat, i.lon))
    return target && hasFix(target.lat, target.lon)
      ? { lat: target.lat as number, lon: target.lon as number, key: target.id } : null
  }, [newestIncident, incidents])

  const busyUnits = (units ?? []).filter(u =>
    ['dispatched', 'en_route', 'on_scene'].includes(u.status))

  return (
    <div className="flex-1 min-h-0 flex flex-col
                    lg:grid lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr_300px] bg-ground">

      {/* Mobile only: the feed and the map each need the full width on a
          phone, so they are switched rather than shown side by side. */}
      <div className="lg:hidden shrink-0 flex gap-1 p-2 bg-ground-card border-b border-ground-line">
        {(['feed', 'map'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
              view === v ? 'bg-brand-50 text-brand-700' : 'text-ink-soft'}`}>
            {v === 'feed' ? `Feed (${activeIncidents.length})` : 'Map'}
          </button>
        ))}
      </div>

      {/* Feed */}
      <section className={`${view === 'feed' ? 'flex' : 'hidden'} lg:flex
                          border-r border-ground-line flex-col min-h-0 bg-ground`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="section-label">Incident feed</h2>
          <span className="text-[11px] text-ink-soft tabular-nums">
            {activeIncidents.length} active · {page?.total ?? 0} total
          </span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 space-y-2.5">
          {isLoading && <p className="text-ink-soft text-sm p-2">Loading…</p>}
          {!isLoading && incidents.length === 0 && (
            <div className="panel p-8 text-center">
              <p className="text-ink font-medium text-sm">No incidents yet</p>
              <p className="text-ink-soft text-xs mt-1">
                Waiting for the first event from the device.
              </p>
            </div>
          )}
          {incidents.map(inc => (
            <IncidentCard key={inc.id} incident={inc}
              deviceName={deviceNames[inc.device_id]} nowMs={nowMs}
              assignedUnits={unitsByIncident[inc.id]} />
          ))}

          {/* The right rail only exists at xl, so below that the fleet summary
              and device health ride along at the end of the feed rather than
              being unreachable. */}
          <div className="xl:hidden space-y-3 pt-1">
            <div className="panel-brand p-4">
              <p className="font-semibold text-[15px]">Response ready</p>
              <p className="text-[11px] text-white/75 mt-0.5">
                {(units ?? []).filter(u => u.status === 'available').length} units available
                {busyUnits.length > 0 && ` · ${busyUnits.length} responding`}
              </p>
            </div>
            {(devices ?? []).map(d => <DeviceCard key={d.id} device={d} nowMs={nowMs} />)}
          </div>
        </div>
      </section>

      {/* Map */}
      <section className={`${view === 'map' ? 'block' : 'hidden'} lg:block relative min-h-0 flex-1`}>
        <MapView pins={pins} focus={focus} zoom={12} />
      </section>

      {/* Right rail */}
      <section className="hidden xl:flex border-l border-ground-line flex-col min-h-0 bg-ground">
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
          {/* Fleet summary — the app's teal hero card */}
          <div className="panel-brand p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                  <path d="M12 2l8 3v6c0 5-3.4 9.1-8 11-4.6-1.9-8-6-8-11V5l8-3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[15px]">Response ready</p>
                <p className="text-[11px] text-white/75">
                  {(units ?? []).filter(u => u.status === 'available').length} units available
                </p>
              </div>
            </div>
            <p className="text-[11px] text-white/80 leading-relaxed">
              Units are ranked by road travel time to each scene, so the fastest
              responder is dispatched — not just the closest one.
            </p>
          </div>

          {busyUnits.length > 0 && (
            <div className="panel p-4">
              <h3 className="section-label mb-2.5">Responding now</h3>
              <div className="space-y-2">
                {busyUnits.map(u => (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: UNIT_COLOR[u.unit_type] }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink whitespace-nowrap">{u.call_sign}</p>
                      <p className="text-[10px] text-ink-soft truncate">{UNIT_LABEL[u.unit_type]}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${
                      UNIT_STATUS_STYLE[u.status]}`}>
                      {UNIT_STATUS_LABEL[u.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="section-label px-1 pt-1">Devices</h3>
          {(devices ?? []).map(d => <DeviceCard key={d.id} device={d} nowMs={nowMs} />)}
          {devices && devices.length === 0 && (
            <div className="panel p-4">
              <p className="text-ink-soft text-xs">
                No devices registered yet. The first event from the ESP32 registers it.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
