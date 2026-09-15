// Responder team management. A dispatch team adds its own operators, so this
// is reachable by any signed-in responder — but never by a driver or an
// anonymous caller, which is where the privilege boundary sits.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateTime } from '../lib/format'
import type { Responder } from '../lib/types'

const MIN_PASSWORD = 12

function AddResponder({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => api.createResponder({
      name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(),
      password: f.password,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['responders'] })
      onDone()
    },
    onError: (e: Error) => setError(e.message),
  })

  const tooShort = f.password.length > 0 && f.password.length < MIN_PASSWORD
  const valid = f.name.trim() && f.email.includes('@') && f.password.length >= MIN_PASSWORD
  const input = 'bg-ground border border-ground-line rounded-xl px-3 py-2 text-sm ' +
    'outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

  return (
    <div className="panel p-4 space-y-3">
      <div>
        <h3 className="section-label">Add a responder</h3>
        <p className="text-[11px] text-ink-soft mt-0.5">
          They sign in with this email and password, and can then use the whole
          console. Share the password with them directly and ask them to change it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input placeholder="Full name" value={f.name} className={input}
          onChange={e => setF({ ...f, name: e.target.value })} />
        <input placeholder="Email" type="email" value={f.email} className={input}
          onChange={e => setF({ ...f, email: e.target.value })} />
        <input placeholder="Phone (optional)" value={f.phone} className={input}
          onChange={e => setF({ ...f, phone: e.target.value })} />
        <input placeholder={`Password (min ${MIN_PASSWORD} characters)`} type="text"
          value={f.password} className={input}
          onChange={e => setF({ ...f, password: e.target.value })} />
      </div>

      {tooShort && (
        <p className="text-[11px] text-amber-700">
          {MIN_PASSWORD - f.password.length} more character
          {MIN_PASSWORD - f.password.length === 1 ? '' : 's'} needed.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button disabled={!valid || create.isPending} onClick={() => create.mutate()}
          className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white
                     text-sm font-semibold disabled:opacity-40">
          {create.isPending ? 'Creating…' : 'Create account'}
        </button>
        <button onClick={onDone}
          className="px-4 py-2 rounded-xl bg-ground text-ink-soft text-sm font-semibold">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Row({ responder, activeCount }: { responder: Responder; activeCount: number }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [error, setError] = useState('')
  const isSelf = user?.id === responder.id
  // Mirrors the server guard, so the button is disabled rather than failing.
  const lastActive = responder.active && activeCount <= 1

  const toggle = useMutation({
    mutationFn: () => api.updateResponder(responder.id, { active: !responder.active }),
    onSuccess: () => { setError(''); qc.invalidateQueries({ queryKey: ['responders'] }) },
    onError: (e: Error) => setError(e.message),
  })

  const initials = responder.name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('') || 'R'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-ground-line last:border-0">
      <span className="w-9 h-9 rounded-full bg-brand-700 text-white text-xs font-bold
                       flex items-center justify-center shrink-0">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-ink truncate">
          {responder.name}
          {isSelf && <span className="ml-2 text-[10px] font-semibold text-ink-soft">(you)</span>}
        </p>
        <p className="text-[11px] text-ink-soft truncate">{responder.email}</p>
        {error && <p className="text-[11px] text-red-600 mt-0.5">{error}</p>}
      </div>
      <span className="text-[11px] text-ink-faint hidden sm:block shrink-0">
        added {dateTime(responder.created_at)}
      </span>
      <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold shrink-0 ${
        responder.active
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
        {responder.active ? 'Active' : 'Disabled'}
      </span>
      <button
        disabled={isSelf || lastActive || toggle.isPending}
        onClick={() => toggle.mutate()}
        title={isSelf ? 'You cannot disable your own account'
          : lastActive ? 'The last active responder cannot be disabled'
          : undefined}
        className="px-2.5 py-1.5 rounded-xl bg-ground hover:bg-ground-line text-ink
                   text-[11px] font-semibold shrink-0 disabled:opacity-40
                   disabled:cursor-not-allowed">
        {responder.active ? 'Disable' : 'Enable'}
      </button>
    </div>
  )
}

export default function Team() {
  const [adding, setAdding] = useState(false)
  const { data: responders, isLoading } = useQuery({
    queryKey: ['responders'], queryFn: api.responders,
  })
  const activeCount = (responders ?? []).filter(r => r.active).length

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-ground">
      <div className="max-w-4xl mx-auto p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Dispatch team</h2>
            <p className="text-xs text-ink-soft">
              Operators who can sign in to this console.
            </p>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)}
              className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800
                         text-white text-sm font-semibold">Add responder</button>
          )}
        </div>

        {adding && <AddResponder onDone={() => setAdding(false)} />}

        <div className="panel">
          <div className="px-4 py-3 border-b border-ground-line">
            <h3 className="section-label">
              Responders ({responders?.length ?? 0}) · {activeCount} active
            </h3>
          </div>
          {isLoading && <p className="px-4 py-6 text-sm text-ink-soft">Loading…</p>}
          {(responders ?? []).map(r => (
            <Row key={r.id} responder={r} activeCount={activeCount} />
          ))}
        </div>

        {/* Kept to one operator-facing sentence. The provisioning mechanics
            (create_responder.py, the register/responder split) belong in the
            README, not on a dispatcher's screen. */}
        <p className="text-[11px] text-ink-soft">
          Drivers are not listed here — they sign up in the Sentinel mobile app
          and only ever see their own device.
        </p>
      </div>
    </div>
  )
}
