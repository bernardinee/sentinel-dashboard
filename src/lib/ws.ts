// Reconnecting WebSocket wrapper (§5.5): exponential backoff, and an
// onReconnect hook the app uses to backfill missed incidents via
// GET /api/v1/incidents?from=<last_seen>. Silently missing an incident is
// worse than no dashboard.
import { WS_URL, API_KEY } from './api'
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
    const ws = new WebSocket(`${WS_URL}/ws/incidents?api_key=${encodeURIComponent(API_KEY)}`)
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

    ws.onclose = () => {
      if (this.closed) return
      const delay = BACKOFF_MS[Math.min(this.attempts, BACKOFF_MS.length - 1)]
      this.attempts += 1
      this.handlers.onState('reconnecting')
      this.timer = setTimeout(() => this.connect(), delay)
    }

    ws.onerror = () => ws.close()
  }
}
