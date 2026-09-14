# sentinel-dashboard

The responder console for the Sentinel accident-detection system. It is what
gets projected during the defence: dark UI, high contrast, readable from the back
of a room.

Every figure on every screen comes from the backend API. There is no seeded data,
no `Math.random()`, and no placeholder incident anywhere the UI can render one.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

```
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080        # wss:// in production
VITE_API_KEY=<same secret as the backend>
```

The backend must be running — see the `sentinel-backend` README.

## Screens

**Live Operations** (`/`) — incident feed on the left, animating in on WebSocket
push, with unacknowledged crashes pulsing; MapLibre map in the centre that
auto-pans to the newest crash; device panel on the right showing GPS fix,
satellites, uptime, free heap and a live-counting heartbeat age. The top bar
carries WebSocket state, today's count, unresolved count and ML API health.

**Incident Detail** (`/incidents/:id`) — the captured 500-sample window is the
centrepiece: resultant magnitude with the 2 g threshold line, the longest
excursion shaded, the peak annotated, and a per-axis toggle. Beside it the crash
signature panel shows each measurement against the threshold it was tested
against, and the classification panel renders `label_source` in plain English —
e.g. *"The model's crash probability (P(crash) = 0.485) cleared the alert
threshold (0.396), but the physics gate rejected it: a 14.0 g peak over 70 ms is
a manoeuvre or impact artifact, not a crash pulse."* Plus a map inset, a
detected → received → inference latency breakdown, the dispatch timeline, and the
acknowledge / dispatch / resolve / false-alarm actions.

**History & Analytics** (`/analytics`) — filterable table with CSV export;
detections over time by severity; `label_source` distribution (how often the
physics gate overrode the model); peak-g histogram with the 2–7 g real-crash band
shaded; end-to-end latency distribution.

**Devices** (`/devices`) — registered devices, 24 h sparklines for satellites,
RSSI, free heap and battery, and emergency-contact CRUD shared with the Sentinel
app's driver role.

### Raw vs filtered peak

The waveform plots the **raw** stored window. The crash-signature figures are
computed on the same window after a zero-phase 20 Hz low-pass filter, applied to
match the model's training pipeline. `filtfilt` overshoots on very sharp
transients, so the filtered peak can exceed the raw peak (observed: 12.15 g raw →
14.02 g filtered). Both numbers are labelled on screen rather than reconciled,
because the difference is real and explainable.

## Live updates

`src/lib/ws.ts` wraps a reconnecting WebSocket with exponential backoff
(1→30 s). `src/lib/live.tsx` pushes incoming frames straight into the react-query
cache and, on every **re**connect, calls
`GET /api/v1/incidents?from=<last seen>` to backfill anything missed while the
socket was down. A dashboard that silently drops an incident is worse than no
dashboard.

## Map

MapLibre GL against keyless OpenStreetMap raster tiles — no Mapbox token to
expire or rate-limit mid-defence. OSM tiles are light, so `.maplibregl-canvas` is
inverted in CSS for the dark look; markers are DOM siblings of the canvas and
keep their true severity colours. (CARTO's dark basemap was tried first and
rejected: it now watermarks free tiles with "API KEY REQUIRED".)

## Stack

React 18 · Vite · TypeScript · Tailwind · MapLibre GL · Recharts ·
@tanstack/react-query.

```
src/
  lib/      api.ts  ws.ts  live.tsx  format.ts  types.ts
  components/ TopBar  IncidentCard  MapView  WaveformChart  Sparkline
              SeverityChip  StatusBadge
  screens/  LiveOps  IncidentDetail  Analytics  Devices
```

`npm run build` typechecks (`tsc`) and bundles.
