import { useState } from 'react'
import { useAuth } from '../lib/auth'

function Logo() {
  return (
    <div className="w-12 h-12 rounded-2xl bg-brand-700 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
        <path d="M12 2l8 3v6c0 5-3.4 9.1-8 11-4.6-1.9-8-6-8-11V5l8-3z" opacity=".95" />
        <path d="M11 8h2v3h3v2h-3v3h-2v-3H8v-2h3V8z" fill="#0d7360" />
      </svg>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError((err as Error).message || 'Sign in failed')
      setBusy(false)
    }
    // On success the provider swaps this screen out, so no need to unset busy.
  }

  const field = 'w-full bg-ground border border-ground-line rounded-xl px-3.5 py-2.5 ' +
    'text-sm text-ink placeholder-ink-faint outline-none transition ' +
    'focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

  return (
    <div className="min-h-screen flex items-center justify-center bg-ground px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo />
          <h1 className="text-xl font-bold text-ink mt-3">Sentinel</h1>
          <p className="text-sm text-ink-soft">Dispatch console</p>
        </div>

        <form onSubmit={submit} className="panel p-6 space-y-4">
          <div>
            <h2 className="section-label">Sign in</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Responder accounts only. Drivers use the Sentinel mobile app.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-ink">Email</label>
            <input
              id="email" type="email" autoComplete="username" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@agency.gov.gh" className={field}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-ink">Password</label>
            <div className="relative">
              <input
                id="password" type={showPassword ? 'text' : 'password'}
                autoComplete="current-password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••" className={`${field} pr-16`}
              />
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg
                           text-[11px] font-semibold text-ink-soft hover:text-ink hover:bg-ground-line/60"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-600 shrink-0 mt-px" fill="currentColor">
                <path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z" />
              </svg>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit" disabled={busy || !email || !password}
            className="w-full rounded-xl bg-brand-700 hover:bg-brand-800 text-white
                       text-sm font-semibold py-2.5 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {busy && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round" />
              </svg>
            )}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-[11px] text-ink-soft leading-relaxed pt-1 border-t border-ground-line">
            Restricted system for authorised emergency personnel. Accounts are
            issued by the system administrator — there is no self-registration.
          </p>
        </form>
      </div>
    </div>
  )
}
