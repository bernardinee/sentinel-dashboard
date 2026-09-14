import type { UnitStatus, UnitType } from './types'

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
