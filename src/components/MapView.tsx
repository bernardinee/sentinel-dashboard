// MapLibre GL on keyless OpenStreetMap raster tiles (§3: no Mapbox token that
// could expire or rate-limit mid-defence).
//
// Why OSM and not CARTO's dark basemap: CARTO now stamps "API KEY REQUIRED"
// watermarks across its free tiles. OSM standard tiles need no key at all.
// They are light, so the canvas is inverted in CSS (.maplibregl-canvas in
// index.css) to produce the dark ops-console look — markers are DOM elements
// outside the canvas and keep their true severity colours.
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { severityColor } from '../lib/format'
import type { Incident } from '../lib/types'

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

const ACCRA: [number, number] = [-0.187, 5.6037]

export interface MapPin {
  id: string
  lat: number
  lon: number
  color: string
  label: string
  sub?: string
  onClick?: () => void
}

export function incidentPins(incidents: Incident[], onClick: (i: Incident) => void): MapPin[] {
  return incidents
    .filter(i => i.lat != null && i.lon != null)
    .map(i => ({
      id: i.id,
      lat: i.lat as number,
      lon: i.lon as number,
      color: severityColor(i.severity_class),
      label: `${i.severity_name ?? 'Pending'} · ${(i.peak_g ?? i.trigger_peak_g ?? 0).toFixed(1)} g`,
      sub: i.event_id,
      onClick: () => onClick(i),
    }))
}

export default function MapView({ pins, focus, zoom = 13 }: {
  pins: MapPin[]
  focus?: { lat: number; lon: number; key?: string } | null
  zoom?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const lastFocusKey = useRef<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: focus ? [focus.lon, focus.lat] : ACCRA,
      zoom,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    return () => {
      markersRef.current.forEach(m => m.remove())
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // sync pins
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = pins.map(p => {
      const el = document.createElement('div')
      el.className = 'sentinel-pin'
      el.style.backgroundColor = p.color
      if (p.onClick) el.addEventListener('click', p.onClick)
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false })
        .setHTML(`<strong>${p.label}</strong>${p.sub ? `<br/><span style="color:#94a3b8">${p.sub}</span>` : ''}`)
      return new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .setPopup(popup)
        .addTo(map)
    })
  }, [pins])

  // auto-pan to the newest crash (§7 screen 1)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    const key = focus.key ?? `${focus.lat},${focus.lon}`
    if (key === lastFocusKey.current) return
    lastFocusKey.current = key
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 13), speed: 1.4 })
  }, [focus])

  return <div ref={containerRef} className="w-full h-full" />
}
