import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      const data = await authApi.me()
      setUser(data.user)
      return data.user
    } catch {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('campusledger:unauthorized', onUnauthorized)
    return () => window.removeEventListener('campusledger:unauthorized', onUnauthorized)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* cookie clearing is best-effort */
    }
    setUser(null)
    navigate('/')
  }, [navigate])

  const value = useMemo(
    () => ({ user, loading, refresh, logout, applyUser: setUser }),
    [user, loading, refresh, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <span className="splash-mark" aria-hidden="true">CL</span>
      <p>Checking your session…</p>
    </div>
  )
}

export function RequireAdmin({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />
  if (user.role !== 'admin') return <Navigate to="/student" replace />
  return children
}

export function RequireStudent({ children, allowPasswordChange = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/student/login" replace state={{ from: location }} />
  if (user.role !== 'student') return <Navigate to="/admin" replace />
  if (user.must_change_password && !allowPasswordChange) {
    return <Navigate to="/student/change-password" replace />
  }
  return children
}
