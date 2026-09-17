import type { DispatchConfig, Unit, UnitStatus, UnitType } from './types'

// ── Responder movement ───────────────────────────────────────────────────────
// The map animates a dispatched unit along its stored road route. The maths
// below MUST match the backend's app/modules/movement.py so the on-map pin and
// the server-side status flip agree; the timing constants come from the server
// (GET /dispatch/config) rather than being hard-coded twice.

export const DEFAULT_DISPATCH_CONFIG: DispatchConfig = { mobilize_s: 8, sim_speed: 1 }

const MOVING: UnitStatus[] = ['dispatched', 'en_route', 'on_scene']

/** A unit currently travelling a route, distilled to what the map animation
 *  needs. `id` matches the unit pin's id so MapView can find the marker. */
export interface UnitMotion {
  id: string
  geometry: [number, number][]
  dispatchedAt: number
  etaS: number
}

export function unitMotions(units: Unit[]): UnitMotion[] {
  const out: UnitMotion[] = []
  for (const u of units) {
    if (u.route_geometry && u.route_geometry.length >= 2 &&
        u.dispatched_at && u.route_eta_s != null && MOVING.includes(u.status)) {
      const t = Date.parse(u.dispatched_at)
      if (!Number.isNaN(t)) {
        out.push({ id: `unit-${u.id}`, geometry: u.route_geometry, dispatchedAt: t, etaS: u.route_eta_s })
      }
    }
  }
  return out
}

/** Fraction [0..1] of the route covered: 0 while mobilising, ramping to 1 on
 *  arrival. Mirrors response_phase() on the backend. */
export function motionFraction(m: UnitMotion, nowMs: number, cfg: DispatchConfig): number {
  const elapsed = (nowMs - m.dispatchedAt) / 1000
  const travel = Math.max(1, m.etaS / cfg.sim_speed)
  if (elapsed < cfg.mobilize_s) return 0
  if (elapsed < cfg.mobilize_s + travel) return (elapsed - cfg.mobilize_s) / travel
  return 1
}

/** Point [lon, lat] at `fraction` along a [[lon,lat],…] polyline, by cumulative
 *  length (planar with a latitude correction — accurate enough at city scale). */
export function pointAlongRoute(geometry: [number, number][], fraction: number): [number, number] {
  if (geometry.length < 2) return geometry[0] ?? [0, 0]
  const frac = Math.min(1, Math.max(0, fraction))
  const cosLat = Math.cos((geometry[0][1] * Math.PI) / 180)
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < geometry.length; i++) {
    const dx = (geometry[i][0] - geometry[i - 1][0]) * cosLat
    const dy = geometry[i][1] - geometry[i - 1][1]
    const d = Math.hypot(dx, dy)
    seg.push(d)
    total += d
  }
  if (total <= 0) return geometry[geometry.length - 1]
  let target = frac * total
  for (let i = 1; i < geometry.length; i++) {
    const d = seg[i - 1]
    if (target <= d) {
      const t = d === 0 ? 0 : target / d
      return [
        geometry[i - 1][0] + (geometry[i][0] - geometry[i - 1][0]) * t,
        geometry[i - 1][1] + (geometry[i][1] - geometry[i - 1][1]) * t,
      ]
    }
    target -= d
  }
  return geometry[geometry.length - 1]
}

export const UNIT_COLOR: Record<UnitType, string> = {
  AMBULANCE: '#0d7360',
  FIRE: '#ea580c',
  POLICE: '#2563eb',
  RESCUE: '#7c3aed',
}

export const UNIT_LABEL: Record<UnitType, string> = {
  AMBULANCE: 'Ambulance',
  FIRE: 'Fire',
  POLICE: 'Police',
  RESCUE: 'Rescue',
}

/** Two-letter glyph drawn inside the map pin. */
export const UNIT_GLYPH: Record<UnitType, string> = {
  AMBULANCE: 'AM', FIRE: 'FR', POLICE: 'PO', RESCUE: 'RS',
}

export const UNIT_TINT: Record<UnitType, string> = {
  AMBULANCE: 'bg-brand-50 text-brand-700',
  FIRE: 'bg-orange-50 text-orange-600',
  POLICE: 'bg-blue-50 text-blue-600',
  RESCUE: 'bg-violet-50 text-violet-600',
}

export const UNIT_STATUS_STYLE: Record<UnitStatus, string> = {
  available: 'bg-green-50 text-green-700 border-green-200',
  dispatched: 'bg-amber-50 text-amber-700 border-amber-200',
  en_route: 'bg-blue-50 text-blue-700 border-blue-200',
  on_scene: 'bg-violet-50 text-violet-700 border-violet-200',
  out_of_service: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  available: 'Available',
  dispatched: 'Dispatched',
  en_route: 'En route',
  on_scene: 'On scene',
  out_of_service: 'Out of service',
}

export function unitIconPath(type: UnitType): string {
  switch (type) {
    case 'AMBULANCE': // cross in a box
      return 'M3 7.5A1.5 1.5 0 014.5 6h15A1.5 1.5 0 0121 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5v-9zM11 9v2H9v2h2v2h2v-2h2v-2h-2V9h-2z'
    case 'FIRE':
      return 'M12 2s1.5 3 1.5 5S12.5 10 12.5 10s3-1 4 1.5c1.4 3.5-1.5 6.5-4.5 6.5s-6-2.2-6-5.5C6 8 12 7 12 2z'
    case 'POLICE': // shield
      return 'M12 2l8 3v6c0 5-3.4 9.1-8 11-4.6-1.9-8-6-8-11V5l8-3z'
    default: // rescue — life ring
      return 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12z'
  }
}

export function etaTone(minutes: number): string {
  if (minutes <= 6) return 'text-green-600'
  if (minutes <= 15) return 'text-amber-600'
  return 'text-red-600'
}
