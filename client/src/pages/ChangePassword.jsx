import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Crest } from '../components/AppShell.jsx'
import { FormBanner, TextField } from '../components/Field.jsx'
import { useToast } from '../toast.jsx'

export default function ChangePassword() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, refresh } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [pending, setPending] = useState(false)

  const forced = Boolean(user?.must_change_password)

  async function onSubmit(event) {
    event.preventDefault()
    setBanner(null)
    const nextErrors = {}
    if (!current) nextErrors.current_password = 'Current password is required.'
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      nextErrors.new_password = 'Use at least 8 characters with a letter and a number.'
    }
    if (next && next !== confirm) nextErrors.confirm = 'Passwords do not match.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setPending(true)
    try {
      await authApi.changePassword({ current_password: current, new_password: next })
      await refresh()
      toast.success('Password changed. You can now sign in with your new password.')
      navigate('/student', { replace: true })
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors)
      setBanner(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="auth-wrap">
      <a className="skip-link" href="#main">Skip to content</a>
      <main id="main" className="auth-card">
        <div className="auth-head">
          <Crest size="md" />
          <div>
            <p className="kicker">Account security</p>
            <h1 className="auth-title">Change your password</h1>
            <p className="auth-sub">
              {forced
                ? 'This is your first sign-in. Set a new password to continue.'
                : 'Update the password on your student account.'}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <FormBanner>{banner}</FormBanner>
          <TextField
            id="current-password"
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            error={errors.current_password}
          />
          <TextField
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters, with a letter and a number."
            value={next}
            onChange={(event) => setNext(event.target.value)}
            error={errors.new_password}
          />
          <TextField
            id="confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={errors.confirm}
          />
          <button type="submit" className="btn btn-navy btn-block" disabled={pending}>
            {pending ? 'Saving…' : 'Set new password'}
          </button>
        </form>

        {!forced && (
          <p className="auth-alt">
            <Link to="/student">← Back to dashboard</Link>
          </p>
        )}
      </main>
    </div>
  )
}
