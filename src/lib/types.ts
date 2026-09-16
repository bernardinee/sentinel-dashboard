// Mirrors API_CONTRACT.md / backend app/schemas.py

export interface Incident {
  id: string
  event_id: string
  device_id: string
  detected_at: string | null
  received_at: string
  severity_class: 0 | 1 | 2 | null
  severity_name: string | null
  confidence: number | null
  p_crash: number | null
  model_severity: string | null
  accident_confirmed: boolean | null
  probabilities: Record<string, number> | null
  peak_g: number | null
  excursion_ms: number | null
  impulse_gs: number | null
  signature_match: boolean | null
  label_source: string | null
  unit_scale_applied: number | null
  inference_time_ms: number | null
  classification_pending: boolean
  trigger_peak_g: number | null
  trigger_jerk_gs: number | null
  lat: number | null
  lon: number | null
  gps_valid: boolean | null
  satellites: number | null
  speed_kmh: number | null
  status: IncidentStatus
  acknowledged_at: string | null
  acknowledged_by: string | null
  resolved_at: string | null
  notes: string | null
}

export type IncidentStatus = 'new' | 'acknowledged' | 'dispatched' | 'resolved' | 'false_alarm'

export interface DispatchEvent {
  id: string
  at: string
  actor: string
  action: string
  note: string | null
}

export interface IncidentDetail extends Incident {
  dispatch_events: DispatchEvent[]
}

export interface IncidentPage {
  items: Incident[]
  total: number
  page: number
  page_size: number
}

export interface IncidentWindow {
  incident_id: string
  fs_hz: number
  ax: number[]
  ay: number[]
  az: number[]
  gx: number[]
  gy: number[]
  gz: number[]
}

export interface Device {
  id: string
  device_id: string
  label: string | null
  firmware_version: string | null
  registered_at: string
  last_seen_at: string | null
  status: 'online' | 'offline' | 'unknown'
  last_lat: number | null
  last_lon: number | null
  last_satellites: number | null
  last_uptime_s: number | null
  last_rssi: number | null
}

export interface Heartbeat {
  at: string
  lat: number | null
  lon: number | null
  satellites: number | null
  uptime_s: number | null
  free_heap: number | null
  rssi: number | null
  battery_v: number | null
}

export interface StatsSummary {
  total_incidents: number
  by_severity: Record<string, number>
  by_label_source: Record<string, number>
  by_status: Record<string, number>
  mean_inference_ms: number | null
  mean_end_to_end_s: number | null
  last_24h: number
  last_7d: number
  last_30d: number
}

export interface MlHealth {
  status: string
  mode?: string
  model?: string
  n_features?: number
  crash_alert_threshold?: number
  taxonomy?: string
  signature?: SignatureThresholds
  error?: string
}

export interface SignatureThresholds {
  profile: string
  peak_min_g: number
  peak_max_g: number
  transient_min_ms: number
  transient_max_ms: number
}

export interface Contact {
  id: string
  device_id: string
  name: string
  phone: string
  relationship: string | null
  priority: number
  active: boolean
}

// ── Response units / dispatch ───────────────────────────────────────────────

export type UnitType = 'AMBULANCE' | 'FIRE' | 'POLICE' | 'RESCUE'
export type UnitStatus =
  | 'available' | 'dispatched' | 'en_route' | 'on_scene' | 'out_of_service'

export interface Unit {
  id: string
  call_sign: string
  unit_type: UnitType
  station_name: string
  home_lat: number
  home_lon: number
  current_lat: number | null
  current_lon: number | null
  status: UnitStatus
  crew_size: number | null
  contact_phone: string | null
  assigned_incident_id: string | null
  active: boolean
  last_update: string
}

export interface RouteInfo {
  distance_km: number
  duration_min: number
  geometry: [number, number][]
  source: 'osrm' | 'straight_line'
}

export interface DispatchOption {
  unit: Unit
  route: RouteInfo
  eta_min: number
  recommended: boolean
}

export interface DispatchOptions {
  incident_id: string
  incident_lat: number
  incident_lon: number
  required_types: UnitType[]
  /** Units free to be sent, fastest first. */
  options: DispatchOption[]
  /** Units already committed to this incident, with their live routes. */
  responding: DispatchOption[]
  routing_source: string
  note: string | null
}

export interface WsEnvelope {
  type: 'incident.created' | 'incident.updated' | 'device_status'
      | 'unit.updated' | 'contact.updated' | 'ping'
  at: string
  data: Record<string, unknown>
}

export interface DeviceStatusMsg {
  device_id: string
  status: string
  last_seen_at: string
  lat: number | null
  lon: number | null
  satellites: number | null
  uptime_s: number | null
  free_heap: number | null
  rssi: number | null
  battery_v: number | null
}

// ── Responder team ──────────────────────────────────────────────────────────

export interface Responder {
  id: string
  name: string
  email: string
  phone: string
  role: string
  active: boolean
  created_at: string
}
