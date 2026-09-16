// Live layer: owns the reconnecting WebSocket, pushes incident events into the
// react-query cache, tracks device status, and backfills after reconnects.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { IncidentSocket, type WsState } from './ws'
import type { DeviceStatusMsg, Incident, IncidentPage, WsEnvelope } from './types'

interface LiveCtx {
  wsState: WsState
  deviceStatus: Record<string, DeviceStatusMsg>
  newestIncident: Incident | null
}

const Ctx = createContext<LiveCtx>({
  wsState: 'connecting',
  deviceStatus: {},
  newestIncident: null,
})

export function useLive() {
  return useContext(Ctx)
}

function upsertIncident(page: IncidentPage | undefined, inc: Incident): IncidentPage | undefined {
  if (!page) return page
  const idx = page.items.findIndex(i => i.id === inc.id)
  if (idx >= 0) {
    const items = [...page.items]
    items[idx] = inc
    return { ...page, items }
  }
  return { ...page, items: [inc, ...page.items], total: page.total + 1 }
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [wsState, setWsState] = useState<WsState>('connecting')
  const [deviceStatus, setDeviceStatus] = useState<Record<string, DeviceStatusMsg>>({})
  const [newestIncident, setNewestIncident] = useState<Incident | null>(null)
  const lastSeenRef = useRef<string>(new Date().toISOString())

  useEffect(() => {
    const applyIncident = (inc: Incident) => {
      lastSeenRef.current = inc.received_at
      qc.setQueriesData<IncidentPage>({ queryKey: ['incidents'] },
        (page) => upsertIncident(page, inc))
      qc.invalidateQueries({ queryKey: ['incident', inc.id] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    }

    const socket = new IncidentSocket({
      onMessage: (msg: WsEnvelope) => {
        if (msg.type === 'incident.created') {
          const inc = msg.data as unknown as Incident
          applyIncident(inc)
          setNewestIncident(inc)
        } else if (msg.type === 'incident.updated') {
          applyIncident(msg.data as unknown as Incident)
        } else if (msg.type === 'device_status') {
          const d = msg.data as unknown as DeviceStatusMsg
          setDeviceStatus(prev => ({ ...prev, [d.device_id]: d }))
          qc.invalidateQueries({ queryKey: ['devices'] })
        } else if (msg.type === 'unit.updated') {
          qc.invalidateQueries({ queryKey: ['units'] })
          qc.invalidateQueries({ queryKey: ['dispatchOptions'] })
        } else if (msg.type === 'contact.updated') {
          // Contact data remains on the device-scoped REST endpoint. The frame
          // is only an invalidation hint, avoiding personal data on the socket.
          qc.invalidateQueries({ queryKey: ['contacts'] })
        }
      },
      onState: setWsState,
      onReconnect: async () => {
        // §5.5 backfill: fetch anything missed while the socket was down.
        try {
          const missed = await api.incidents({ from: lastSeenRef.current, page_size: 100 })
          missed.items.slice().reverse().forEach(applyIncident)
          if (missed.items.length > 0) setNewestIncident(missed.items[0])
        } catch { /* next reconnect will retry */ }
        qc.invalidateQueries()
      },
    })
    socket.start()
    return () => socket.stop()
  }, [qc])

  const value = useMemo(() => ({ wsState, deviceStatus, newestIncident }),
    [wsState, deviceStatus, newestIncident])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
