// MapLibre GL with OpenFreeMap's documented, keyless vector style.
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { hasFix, severityColor } from '../lib/format'
import { UNIT_COLOR, UNIT_GLYPH, UNIT_LABEL } from '../lib/units'
import type { Incident, Unit } from '../lib/types'

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const ACCRA: [number, number] = [-0.187, 5.6037]
const ROUTE_SOURCE = 'dispatch-route'

export interface MapPin {
  id: string
  lat: number
  lon: number
  color: string
  label: string
  sub?: string
  kind?: 'incident' | 'unit'
  glyph?: string
  onClick?: () => void
}

/** A route to draw on the map: GeoJSON [lon,lat] pairs from OSRM. */
export interface MapRoute {
  geometry: [number, number][]
  color?: string
  dashed?: boolean
}

export function incidentPins(incidents: Incident[], onClick: (i: Incident) => void): MapPin[] {
  return incidents
    .filter(i => hasFix(i.lat, i.lon))
    .map(i => ({
      id: `inc-${i.id}`,
      lat: i.lat as number,
      lon: i.lon as number,
      color: severityColor(i.severity_class),
      label: `${i.severity_name ?? 'Pending'} · ${(i.peak_g ?? i.trigger_peak_g ?? 0).toFixed(1)} g`,
      sub: i.event_id,
      kind: 'incident' as const,
      onClick: () => onClick(i),
    }))
}

export function unitPins(units: Unit[], onClick?: (u: Unit) => void): MapPin[] {
  return units
    .filter(u => u.active)
    .map(u => {
      const lat = u.current_lat ?? u.home_lat
      const lon = u.current_lon ?? u.home_lon
      return { lat, lon, u }
    })
    .filter(({ lat, lon }) => hasFix(lat, lon))
    .map(({ lat, lon, u }) => {
      return {
        id: `unit-${u.id}`,
        lat, lon,
        color: UNIT_COLOR[u.unit_type],
        label: `${u.call_sign} · ${UNIT_LABEL[u.unit_type]}`,
        sub: `${u.station_name} — ${u.status.replace('_', ' ')}`,
        kind: 'unit' as const,
        glyph: UNIT_GLYPH[u.unit_type],
        onClick: onClick ? () => onClick(u) : undefined,
      }
    })
}

export default function MapView({ pins, routes = [], focus, zoom = 12, fitAll = false, visible = true }: {
  pins: MapPin[]
  routes?: MapRoute[]
  focus?: { lat: number; lon: number; key?: string } | null
  zoom?: number
  fitAll?: boolean
  visible?: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const lastFocusKey = useRef<string | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: focus ? [focus.lon, focus.lat] : ACCRA,
      zoom,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      readyRef.current = true
      map.addSource(ROUTE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      // casing under the line so the route stays legible over busy streets
      map.addLayer({
        id: `${ROUTE_SOURCE}-casing`, type: 'line', source: ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 },
      })
      // Solid = real road route, dashed = straight-line estimate. These are two
      // layers because MapLibre does not accept data-driven line-dasharray.
      map.addLayer({
        id: `${ROUTE_SOURCE}-line`, type: 'line', source: ROUTE_SOURCE,
        filter: ['!=', ['get', 'dashed'], true],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#0d7360'],
          'line-width': 4.5,
        },
      })
      map.addLayer({
        id: `${ROUTE_SOURCE}-dashed`, type: 'line', source: ROUTE_SOURCE,
        filter: ['==', ['get', 'dashed'], true],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#0d7360'],
          'line-width': 4,
          'line-dasharray': [2, 1.5],
        },
      })
    })
    mapRef.current = map
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!visible) return
    const frame = requestAnimationFrame(() => mapRef.current?.resize())
    return () => cancelAnimationFrame(frame)
  }, [visible])

  // ── markers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = pins.map(p => {
      const el = document.createElement('div')
      if (p.kind === 'unit') {
        el.className = 'unit-pin'
        el.style.backgroundColor = p.color
        el.textContent = p.glyph ?? ''
      } else {
        el.className = 'sentinel-pin'
        el.style.backgroundColor = p.color
      }
      if (p.onClick) el.addEventListener('click', p.onClick)
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false })
        .setHTML(`<strong>${p.label}</strong>${
          p.sub ? `<br/><span style="color:#6b7280">${p.sub}</span>` : ''}`)
      return new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .setPopup(popup)
        .addTo(map)
    })
  }, [pins])

  // ── routes ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const src = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (!src) return
      src.setData({
        type: 'FeatureCollection',
        features: routes
          .filter(r => r.geometry.length > 1)
          .map(r => ({
            type: 'Feature' as const,
            properties: { color: r.color ?? '#0d7360', dashed: !!r.dashed },
            geometry: { type: 'LineString' as const, coordinates: r.geometry },
          })),
      })
      // frame the route so the dispatcher sees both ends at once
      if (routes.length === 1 && routes[0].geometry.length > 1) {
        const coords = routes[0].geometry
        const b = coords.reduce(
          (acc, c) => acc.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number],
                                      coords[0] as [number, number]))
        map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 600 })
      }
    }
    if (readyRef.current) apply()
    else map.once('load', apply)
  }, [routes])

  // ── camera ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (fitAll && pins.length > 1 && !focus) {
      const b = pins.reduce(
        (acc, p) => acc.extend([p.lon, p.lat] as [number, number]),
        new maplibregl.LngLatBounds([pins[0].lon, pins[0].lat], [pins[0].lon, pins[0].lat]))
      map.fitBounds(b, { padding: 70, maxZoom: 13, duration: 0 })
      return
    }
    if (!focus) return
    const key = focus.key ?? `${focus.lat},${focus.lon}`
    if (key === lastFocusKey.current) return
    lastFocusKey.current = key
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 13), speed: 1.4 })
  }, [focus, fitAll, pins])

  return <div ref={containerRef} className="w-full h-full" />
}
