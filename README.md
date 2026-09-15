# sentinel-dashboard

The responder console for the Sentinel accident-detection system.

It uses the same visual language as the Sentinel mobile app — light ground, white
cards with hairline borders and generous rounding, deep teal as the primary and
red reserved strictly for emergency actions — so the operator console and the
driver's phone read as one product.

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
```

No API key reaches the browser. Responders sign in with an email and password,
and the console authenticates with their short-lived access token.

The backend must be running — see the `sentinel-backend` README, and create an
account with `scripts/create_responder.py` before your first sign-in.

## Sessions

The access token lives **in memory only**, so a stored XSS payload cannot read
it and it dies with the tab. The refresh token is persisted so a reload does not
force a new sign-in; it is single-use, rotates on every exchange, and the backend
revokes the whole family if a rotated token is ever replayed. Sign-out revokes
it server-side rather than just forgetting it locally.

The WebSocket authenticates with the same access token as a query parameter,
because browsers cannot set headers on a WebSocket handshake.

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

**Fleet** (`/fleet`) — every emergency unit, its live status, and where it is
stationed, on one map of Greater Accra. Counts of available / on a call / out of
service, filters by service type, and a form to register new units.

**History & Analytics** (`/analytics`) — filterable table with CSV export;
detections over time by severity; `label_source` distribution (how often the
physics gate overrode the model); peak-g histogram with the 2–7 g real-crash band
shaded; end-to-end latency distribution.

**Devices** (`/devices`) — registered devices, 24 h sparklines for satellites,
RSSI, free heap and battery, and emergency-contact CRUD shared with the Sentinel
app's driver role.

### Dispatching units

The incident detail screen carries a dispatch panel listing available units
**ranked by road travel time to the scene, not straight-line distance** — the
nearest unit as the crow flies is routinely not the fastest once Accra's ring
roads and the Korle lagoon are taken into account. The fastest unit of each
service the severity calls for is flagged FASTEST, ETAs are colour-coded, and
hovering a candidate draws its actual road route on the map in that service's
colour. Once dispatched, a unit moves to the top of the panel with controls to
mark it en route, on scene, or cleared — each writing to the incident timeline.

Routes that came from a real road router are drawn solid; when routing is
unavailable the ETA is a marked estimate and its route is drawn dashed and
labelled "est.", so a guess never looks like a road route.

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
expire or rate-limit mid-defence. (CARTO's basemap was tried first and rejected:
it now watermarks its free tiles with "API KEY REQUIRED".) The console theme is
light, so OSM's own tiles are used as-is.

Incident pins are coloured by severity; unit pins carry a two-letter service
glyph in the service colour. Route lines are drawn from a GeoJSON source with a
white casing beneath so they stay legible over busy streets.

## Stack

React 18 · Vite · TypeScript · Tailwind · MapLibre GL · Recharts ·
@tanstack/react-query.

```
src/
  lib/      api.ts  auth.tsx  ws.ts  live.tsx  format.ts  units.ts  types.ts
  components/ TopBar  IncidentCard  MapView  WaveformChart  DispatchPanel
              Sparkline  SeverityChip  StatusBadge
  screens/  Login  LiveOps  IncidentDetail  Fleet  Analytics  Devices
```

Theme tokens (`ink`, `ground`, `brand`, `sev`, `unit`) live in
`tailwind.config.js`; `.panel` and `.panel-brand` in `index.css` are the card
surfaces.

`npm run build` typechecks (`tsc`) and bundles.
