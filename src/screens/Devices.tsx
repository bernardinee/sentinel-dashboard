// §7 Screen 4 — Device management: heartbeat history, GPS quality,
// emergency-contact CRUD (shared with Sentinel's driver role).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { dateTime, timeAgo, uptime } from '../lib/format'
import Sparkline from '../components/Sparkline'
import type { Contact, Device } from '../lib/types'

function Contacts({ device }: { device: Device }) {
  const qc = useQueryClient()
  const key = ['contacts', device.device_id]
  const { data: contacts } = useQuery({
    queryKey: key, queryFn: () => api.contacts(device.device_id),
  })
  const [draft, setDraft] = useState({ name: '', phone: '', relationship: '' })
  const [error, setError] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: key })
  const add = useMutation({
    mutationFn: () => api.addContact(device.device_id, {
      name: draft.name, phone: draft.phone,
      relationship: draft.relationship || null, priority: (contacts?.length ?? 0) + 1,
      active: true,
    }),
    onSuccess: () => { setDraft({ name: '', phone: '', relationship: '' }); setError(''); invalidate() },
    onError: (e: Error) => setError(e.message),
  })
  const toggle = useMutation({
    mutationFn: (c: Contact) => api.updateContact(device.device_id, c.id, { active: !c.active }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (c: Contact) => api.deleteContact(device.device_id, c.id),
    onSuccess: invalidate,
  })

  const input = 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs'
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Emergency contacts
      </h4>
      <div className="space-y-1.5 mb-3">
        {(contacts ?? []).map(c => (
          <div key={c.id} className="flex items-center gap-2 text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
            <span className={`font-semibold ${c.active ? 'text-slate-200' : 'text-slate-600 line-through'}`}>
              {c.name}
            </span>
            <span className="text-slate-500">{c.phone}</span>
            {c.relationship && <span className="text-slate-600">· {c.relationship}</span>}
            <span className="flex-1" />
            <button onClick={() => toggle.mutate(c)}
              className="text-slate-500 hover:text-slate-300">{c.active ? 'disable' : 'enable'}</button>
            <button onClick={() => remove.mutate(c)}
              className="text-red-500 hover:text-red-400">remove</button>
          </div>
        ))}
        {contacts && contacts.length === 0 && (
          <p className="text-xs text-slate-600">
            None yet. The ESP32 keeps its own hardcoded SMS list as the fail-safe.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <input placeholder="Name" value={draft.name} className={`${input} flex-1`}
          onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <input placeholder="+233…" value={draft.phone} className={`${input} w-32`}
          onChange={e => setDraft({ ...draft, phone: e.target.value })} />
        <input placeholder="Relation" value={draft.relationship} className={`${input} w-24`}
          onChange={e => setDraft({ ...draft, relationship: e.target.value })} />
        <button disabled={!draft.name || !draft.phone || add.isPending}
          onClick={() => add.mutate()}
          className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-semibold disabled:opacity-40">
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  )
}

function DevicePanel({ device }: { device: Device }) {
  const { data: heartbeats } = useQuery({
    queryKey: ['heartbeats', device.device_id],
    queryFn: () => api.heartbeats(device.device_id, 24),
    refetchInterval: 60000,
  })
  const hb = heartbeats ?? []
  const online = device.status === 'online'

  return (
    <div className="panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold">{device.device_id}</h3>
          <p className="text-[11px] text-slate-500">
            fw {device.firmware_version ?? '—'} · registered {dateTime(device.registered_at)}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-bold ${
          online ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {device.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {[
          ['Last seen', device.last_seen_at ? timeAgo(device.last_seen_at) : 'never'],
          ['Uptime', uptime(device.last_uptime_s)],
          ['Satellites', device.last_satellites ?? '—'],
          ['RSSI', device.last_rssi != null ? `${device.last_rssi} dBm` : '—'],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
            <p className="font-bold tabular-nums mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'GPS satellites · 24 h', values: hb.map(h => h.satellites), color: '#38bdf8' },
          { label: 'RSSI dBm · 24 h', values: hb.map(h => h.rssi), color: '#a78bfa' },
          { label: 'Free heap · 24 h', values: hb.map(h => h.free_heap), color: '#34d399' },
          { label: 'Battery V · 24 h', values: hb.map(h => h.battery_v), color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{s.label}</p>
            <Sparkline values={s.values} color={s.color} />
          </div>
        ))}
      </div>

      <Contacts device={device} />
    </div>
  )
}

export default function Devices() {
  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices'], queryFn: api.devices, refetchInterval: 30000,
  })
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto p-5 space-y-4">
        <h2 className="font-bold">Registered devices</h2>
        {isLoading && <p className="text-slate-500 text-sm">Loading…</p>}
        {(devices ?? []).map(d => <DevicePanel key={d.id} device={d} />)}
        {devices && devices.length === 0 && (
          <div className="panel p-10 text-center text-slate-500 text-sm">
            No devices yet — the first event or heartbeat from the ESP32 registers it.
          </div>
        )}
      </div>
    </div>
  )
}
