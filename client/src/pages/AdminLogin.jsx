import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Crest } from '../components/AppShell.jsx'
import { FormBanner, TextField } from '../components/Field.jsx'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { user, loading, applyUser, refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!loading && user?.role === 'admin') navigate('/admin', { replace: true })
    if (!loading && user?.role === 'student') navigate('/student', { replace: true })
  }, [user, loading, navigate])

  async function onSubmit(event) {
    event.preventDefault()
    setBanner(null)
    setErrors({})
    const nextErrors = {}
    if (!email.trim()) nextErrors.email = 'Email is required.'
    if (!password) nextErrors.password = 'Password is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setPending(true)
    try {
      const data = await authApi.adminLogin({ email: email.trim(), password })
      applyUser(data.user)
      navigate('/admin', { replace: true })
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors)
      setBanner(err.message)
      if (err.status === 401) {
        refresh()
      }
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
            <p className="kicker">Administrator access</p>
            <h1 className="auth-title">CampusLedger</h1>
            <p className="auth-sub">Sign in with the admin email on record.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <FormBanner>{banner}</FormBanner>
          <TextField
            id="admin-email"
            label="Admin email"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="admin@campusledger.edu"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
          />
          <TextField
            id="admin-password"
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <button type="submit" className="btn btn-navy btn-block" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in as administrator'}
          </button>
        </form>

        <p className="auth-alt">
          Are you a student? <Link to="/student/login">Student sign in</Link>
        </p>
        <p className="auth-alt">
          <Link to="/">← Back to home</Link>
        </p>
      </main>
    </div>
  )
}
