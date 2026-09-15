// Reconnecting WebSocket wrapper (§5.5): exponential backoff, and an
// onReconnect hook the app uses to backfill missed incidents via
// GET /api/v1/incidents?from=<last_seen>. Silently missing an incident is
// worse than no dashboard.
import { WS_URL } from './api'
import { currentAccessToken } from './auth'
import type { WsEnvelope } from './types'

export type WsState = 'connecting' | 'connected' | 'reconnecting'

interface Handlers {
  onMessage: (msg: WsEnvelope) => void
  onState: (state: WsState) => void
  onReconnect: () => void // fired on every successful reconnect (not first connect)
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000]

export class IncidentSocket {
  private ws: WebSocket | null = null
  private attempts = 0
  private closed = false
  private everConnected = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private handlers: Handlers) {}

  start() {
    this.closed = false
    this.connect()
  }

  stop() {
    this.closed = true
    if (this.timer) clearTimeout(this.timer)
    this.ws?.close()
  }

  private connect() {
    this.handlers.onState(this.everConnected ? 'reconnecting' : 'connecting')
    // Browsers cannot set headers on a WebSocket handshake, so the backend
    // also accepts the access token as a query parameter. It is short-lived
    // and rotates, unlike the shared key this replaced.
    const token = currentAccessToken()
    if (!token) {
      // No session yet — retry on the normal backoff rather than opening an
      // unauthenticated socket the server will just close.
      this.scheduleReconnect()
      return
    }
    const ws = new WebSocket(
      `${WS_URL}/ws/incidents?access_token=${encodeURIComponent(token)}`)
    this.ws = ws

    ws.onopen = () => {
      const wasReconnect = this.everConnected
      this.everConnected = true
      this.attempts = 0
      this.handlers.onState('connected')
      if (wasReconnect) this.handlers.onReconnect()
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsEnvelope
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }
        this.handlers.onMessage(msg)
      } catch { /* malformed frame — ignore */ }
    }

    ws.onclose = () => this.scheduleReconnect()

    ws.onerror = () => ws.close()
  }

  /** Back off and try again. Shared by socket closure and the
   *  no-session-yet case, so both follow the same schedule. */
  private scheduleReconnect() {
    if (this.closed) return
    const delay = BACKOFF_MS[Math.min(this.attempts, BACKOFF_MS.length - 1)]
    this.attempts += 1
    this.handlers.onState('reconnecting')
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.connect(), delay)
  }
}
