// Session handling for the dispatch console.
//
// The access token is kept in memory only — never localStorage — so a stored
// XSS payload cannot read it, and it dies with the tab. The refresh token is
// persisted so a reload does not force a new sign-in; it is single-use and
// rotates on every exchange, and the backend revokes the whole family if a
// rotated token is ever replayed.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { API_URL } from './api'

const REFRESH_KEY = 'sentinel.refresh'
// Refresh a little before expiry so a request never races the rotation.
const REFRESH_MARGIN_S = 60

export interface SessionUser {
  id: string
  name: string
  email: string
  phone: string
  role: string
  device_id: string | null
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: SessionUser
}

interface AuthCtx {
  user: SessionUser | null
  /** null until the stored refresh token has been tried, so guards can wait. */
  restoring: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Current access token, or null. Read at call time — it rotates. */
  getToken: () => string | null
}

const Ctx = createContext<AuthCtx | null>(null)

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Module-level so the plain fetch wrapper in api.ts can read it without
 *  needing React context. */
let accessToken: string | null = null
export function currentAccessToken(): string | null {
  return accessToken
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const parsed = await resp.json()
      detail = parsed.detail ?? detail
    } catch { /* keep statusText */ }
    throw new Error(detail)
  }
  return resp.json() as Promise<T>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [restoring, setRestoring] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const clearSession = useCallback(() => {
    clearTimer()
    accessToken = null
    setUser(null)
    try { localStorage.removeItem(REFRESH_KEY) } catch { /* private mode */ }
  }, [])

  // Declared via ref so adopt() and refreshNow() can call each other without
  // a circular dependency in the hook graph.
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  const adopt = useCallback((t: TokenResponse) => {
    accessToken = t.access_token
    setUser(t.user)
    try { localStorage.setItem(REFRESH_KEY, t.refresh_token) } catch { /* private mode */ }
    clearTimer()
    const delay = Math.max(10, t.expires_in - REFRESH_MARGIN_S) * 1000
    timer.current = setTimeout(() => { void refreshRef.current() }, delay)
  }, [])

  refreshRef.current = async () => {
    let stored: string | null = null
    try { stored = localStorage.getItem(REFRESH_KEY) } catch { /* private mode */ }
    if (!stored) { clearSession(); return }
    try {
      adopt(await postJson<TokenResponse>('/api/v1/auth/refresh', { refresh_token: stored }))
    } catch {
      // Expired, revoked, or replayed — the only safe response is to sign out.
      clearSession()
    }
  }

  // Restore a session on load, if a refresh token survived.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      let stored: string | null = null
      try { stored = localStorage.getItem(REFRESH_KEY) } catch { /* private mode */ }
      if (stored) {
        try {
          const t = await postJson<TokenResponse>('/api/v1/auth/refresh',
            { refresh_token: stored })
          if (!cancelled) adopt(t)
        } catch {
          if (!cancelled) clearSession()
        }
      }
      if (!cancelled) setRestoring(false)
    })()
    return () => { cancelled = true; clearTimer() }
  }, [adopt, clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const t = await postJson<TokenResponse>('/api/v1/auth/login',
      { email: email.trim().toLowerCase(), password })
    if (t.user.role !== 'responder') {
      // Driver accounts exist for the mobile app and have no business here.
      throw new Error('This console is for responder accounts only.')
    }
    adopt(t)
  }, [adopt])

  const logout = useCallback(async () => {
    let stored: string | null = null
    try { stored = localStorage.getItem(REFRESH_KEY) } catch { /* private mode */ }
    clearSession()
    if (stored) {
      // Revoke server-side too, so the token cannot be replayed.
      try { await postJson('/api/v1/auth/logout', { refresh_token: stored }) } catch { /* best effort */ }
    }
  }, [clearSession])

  const value = useMemo<AuthCtx>(
    () => ({ user, restoring, login, logout, getToken: () => accessToken }),
    [user, restoring, login, logout])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
