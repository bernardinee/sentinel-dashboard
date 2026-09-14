// REST client. Every request carries the shared X-API-Key (see .env.example).
import type {
  Contact, Device, Heartbeat, Incident, IncidentDetail, IncidentPage,
  IncidentWindow, MlHealth, StatsSummary,
} from './types'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
export const WS_URL: string = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'
export const API_KEY: string = import.meta.env.VITE_API_KEY ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(init?.headers ?? {}),
    },
  })
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch { /* keep statusText */ }
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
