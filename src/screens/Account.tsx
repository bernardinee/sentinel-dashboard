import { useState } from 'react'
import { useAuth } from '../lib/auth'

const MIN_PASSWORD = 12

export default function Account() {
  const { user, changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && next !== confirm
  const sameAsOld = next.length > 0 && next === current
  const valid = current && next.length >= MIN_PASSWORD && next === confirm && !sameAsOld

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setDone(false)
    try {
      await changePassword(current, next)
      setCurrent(''); setNext(''); setConfirm('')
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full bg-ground border border-ground-line rounded-xl px-3.5 py-2.5 ' +
    'text-sm text-ink placeholder-ink-faint outline-none transition ' +
    'focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-ground">
      <div className="max-w-xl mx-auto p-3 sm:p-5 space-y-3 sm:space-y-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Your account</h2>
          <p className="text-xs text-ink-soft">Signed in as {user?.email}</p>
        </div>

        <form onSubmit={submit} className="panel p-5 space-y-4">
          <div>
            <h3 className="section-label">Change password</h3>
            <p className="text-[11px] text-ink-soft mt-0.5">
              Changing your password signs you out on every other device. This
              tab stays signed in.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="current" className="text-xs font-medium text-ink">
              Current password
            </label>
            <input id="current" type={show ? 'text' : 'password'} required
              autoComplete="current-password" value={current}
              onChange={e => setCurrent(e.target.value)} className={field} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="next" className="text-xs font-medium text-ink">
              New password
            </label>
            <input id="next" type={show ? 'text' : 'password'} required
              autoComplete="new-password" value={next}
              onChange={e => setNext(e.target.value)} className={field}
              placeholder={`At least ${MIN_PASSWORD} characters`} />
            {tooShort && (
              <p className="text-[11px] text-amber-700">
                {MIN_PASSWORD - next.length} more character
                {MIN_PASSWORD - next.length === 1 ? '' : 's'} needed.
              </p>
            )}
            {sameAsOld && (
              <p className="text-[11px] text-amber-700">
                Choose something different from your current password.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-xs font-medium text-ink">
              Confirm new password
            </label>
            <input id="confirm" type={show ? 'text' : 'password'} required
              autoComplete="new-password" value={confirm}
              onChange={e => setConfirm(e.target.value)} className={field} />
            {mismatch && (
              <p className="text-[11px] text-amber-700">Passwords do not match.</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-[11px] text-ink-soft select-none">
            <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)}
              className="rounded border-ground-line" />
            Show passwords
          </label>

          {error && (
            <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-600 shrink-0 mt-px" fill="currentColor">
                <path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z" />
              </svg>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {done && (
            <div role="status" className="flex gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600 shrink-0 mt-px" fill="currentColor">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
              </svg>
              <p className="text-xs text-green-700">
                Password changed. Other devices have been signed out.
              </p>
            </div>
          )}

          <button type="submit" disabled={!valid || busy}
            className="w-full rounded-xl bg-brand-700 hover:bg-brand-800 text-white
                       text-sm font-semibold py-2.5 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? 'Changing…' : 'Change password'}
          </button>
        </form>

        <p className="text-[11px] text-ink-soft">
          Forgotten your password? Another responder can reset it from the Team
          screen, or an administrator can from the server.
        </p>
      </div>
    </div>
  )
}
