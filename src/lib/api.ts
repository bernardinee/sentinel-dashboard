// REST client. Every request carries the signed-in responder's Bearer token.
import { currentAccessToken } from './auth'
import type {
  Contact, Device, DispatchOptions, Heartbeat, Incident, IncidentDetail,
  IncidentPage, IncidentWindow, MlHealth, Responder, StatsSummary, Unit,
  UnitStatus, UnitType,
} from './types'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
export const WS_URL: string = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'

// No API key is shipped to the browser any more. Every request carries the
// signed-in responder's short-lived access token, which lives in memory only.
// The old VITE_API_KEY was readable by anyone who opened the bundle, which
// handed them full dispatch control.
export class UnauthorizedError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = currentAccessToken()
  const resp = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch { /* keep statusText */ }
    // 401 means the session is gone; surface it as its own type so callers can
    // bounce to the login screen instead of rendering a scary error.
    if (resp.status === 401) throw new UnauthorizedError(detail)
    throw new Error(`${resp.status}: ${detail}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json() as Promise<T>
}

export interface IncidentFilters {
  status?: string
  severity_class?: number
  device_id?: string
  accident_confirmed?: boolean
  from?: string
  to?: string
  page?: number
  page_size?: number
}

export const api = {
  incidents: (f: IncidentFilters = {}) => {
    const q = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v))
    })
    return request<IncidentPage>(`/api/v1/incidents?${q}`)
  },
  incident: (id: string) => request<IncidentDetail>(`/api/v1/incidents/${id}`),
  incidentWindow: (id: string) => request<IncidentWindow>(`/api/v1/incidents/${id}/window`),
  activeIncidents: () => request<Incident[]>(`/api/v1/incidents/active`),
  devices: () => request<Device[]>(`/api/v1/devices`),
  device: (deviceId: string) => request<Device>(`/api/v1/devices/${deviceId}`),
  heartbeats: (deviceId: string, hours = 24) =>
    request<Heartbeat[]>(`/api/v1/devices/${deviceId}/heartbeats?hours=${hours}`),
  stats: () => request<StatsSummary>(`/api/v1/stats/summary`),
  mlHealth: () => request<MlHealth>(`/api/v1/ml/health`),

  acknowledge: (id: string, actor: string, note?: string) =>
    request<Incident>(`/api/v1/incidents/${id}/acknowledge`,
      { method: 'POST', body: JSON.stringify({ actor, note }) }),
  dispatch: (id: string, actor: string, action: 'assign' | 'en_route' | 'on_scene', note?: string) =>
    request<Incident>(`/api/v1/incidents/${id}/dispatch`,
      { method: 'POST', body: JSON.stringify({ actor, action, note }) }),
  resolve: (id: string, actor: string, outcome: 'resolved' | 'false_alarm', note?: string) =>
    request<Incident>(`/api/v1/incidents/${id}/resolve`,
      { method: 'POST', body: JSON.stringify({ actor, outcome, note }) }),

  // ── Response units / dispatch ─────────────────────────────────────────────
  units: () => request<Unit[]>(`/api/v1/units`),
  registerUnit: (u: {
    call_sign: string; unit_type: UnitType; station_name: string
    home_lat: number; home_lon: number; crew_size?: number; contact_phone?: string
  }) => request<Unit>(`/api/v1/units`, { method: 'POST', body: JSON.stringify(u) }),
  updateUnit: (callSign: string, patch: Partial<Unit>) =>
    request<Unit>(`/api/v1/units/${callSign}`,
      { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteUnit: (callSign: string) =>
    request<void>(`/api/v1/units/${callSign}`, { method: 'DELETE' }),
  dispatchOptions: (incidentId: string) =>
    request<DispatchOptions>(`/api/v1/incidents/${incidentId}/dispatch-options`),
  assignUnit: (incidentId: string, call_sign: string, actor: string, note?: string) =>
    request<Incident>(`/api/v1/incidents/${incidentId}/assign-unit`,
      { method: 'POST', body: JSON.stringify({ call_sign, actor, note }) }),
  setUnitStatus: (callSign: string, status: UnitStatus, actor: string, note?: string) =>
    request<Unit>(`/api/v1/units/${callSign}/status`,
      { method: 'POST', body: JSON.stringify({ status, actor, note }) }),

  // ── Responder team ────────────────────────────────────────────────────────
  responders: () => request<Responder[]>(`/api/v1/auth/responders`),
  createResponder: (r: { name: string; email: string; phone?: string; password: string }) =>
    request<Responder>(`/api/v1/auth/responders`,
      { method: 'POST', body: JSON.stringify(r) }),
  updateResponder: (id: string, patch: { active?: boolean; name?: string; password?: string }) =>
    request<Responder>(`/api/v1/auth/responders/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) }),

  contacts: (deviceId: string) => request<Contact[]>(`/api/v1/devices/${deviceId}/contacts`),
  addContact: (deviceId: string, c: Omit<Contact, 'id' | 'device_id'>) =>
    request<Contact>(`/api/v1/devices/${deviceId}/contacts`,
      { method: 'POST', body: JSON.stringify(c) }),
  updateContact: (deviceId: string, id: string, c: Partial<Omit<Contact, 'id' | 'device_id'>>) =>
    request<Contact>(`/api/v1/devices/${deviceId}/contacts/${id}`,
      { method: 'PATCH', body: JSON.stringify(c) }),
  deleteContact: (deviceId: string, id: string) =>
    request<void>(`/api/v1/devices/${deviceId}/contacts/${id}`, { method: 'DELETE' }),
}
