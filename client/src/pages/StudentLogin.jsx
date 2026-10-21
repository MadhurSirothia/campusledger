import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Crest } from '../components/AppShell.jsx'
import { FormBanner, TextField } from '../components/Field.jsx'

export default function StudentLogin() {
  const navigate = useNavigate()
  const { user, loading, applyUser } = useAuth()
  const [rollNo, setRollNo] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!loading && user?.role === 'student') navigate('/student', { replace: true })
    if (!loading && user?.role === 'admin') navigate('/admin', { replace: true })
  }, [user, loading, navigate])

  async function onSubmit(event) {
    event.preventDefault()
    setBanner(null)
    setErrors({})
    const nextErrors = {}
    if (!rollNo.trim()) nextErrors.roll_no = 'Roll number is required.'
    if (!password) nextErrors.password = 'Password is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setPending(true)
    try {
      const data = await authApi.studentLogin({ roll_no: rollNo.trim(), password })
      applyUser(data.user)
      navigate(data.user.must_change_password ? '/student/change-password' : '/student', {
        replace: true,
      })
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
            <p className="kicker">Student access</p>
            <h1 className="auth-title">Sign in</h1>
            <p className="auth-sub">Use the roll number and password from your welcome email.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <FormBanner>{banner}</FormBanner>
          <TextField
            id="student-roll"
            label="Roll number"
            name="roll_no"
            autoComplete="username"
            placeholder="e.g. 21B81A0001"
            required
            value={rollNo}
            onChange={(event) => setRollNo(event.target.value)}
            error={errors.roll_no}
          />
          <TextField
            id="student-password"
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <button type="submit" className="btn btn-gold btn-block" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in as student'}
          </button>
        </form>

        <p className="auth-alt">
          Lost your password? Ask the administrator to reset it.
        </p>
        <p className="auth-alt">
          Administrator? <Link to="/admin/login">Admin sign in</Link> · <Link to="/">Home</Link>
        </p>
      </main>
    </div>
  )
}
