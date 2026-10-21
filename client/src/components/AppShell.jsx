import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export function Crest({ size = 'md', className = '' }) {
  return (
    <span className={`crest crest-${size} ${className}`.trim()} aria-hidden="true">
      <span className="crest-inner">CL</span>
    </span>
  )
}

function Sidebar({ items, userLabel, onLogout, open, onClose }) {
  const location = useLocation()
  return (
    <div className={`sidebar${open ? ' sidebar-open' : ''}`} id="app-sidebar">
      <div className="brand-block">
        <Crest size="sm" />
        <div className="brand-text">
          <span className="brand-name">CampusLedger</span>
          <span className="brand-tag">College Attendance</span>
        </div>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close navigation menu">
          ×
        </button>
      </div>

      <nav aria-label="Primary">
        <ul className="nav-list">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `nav-link${isActive || (!item.end && location.pathname.startsWith(item.to) && item.to !== '/') ? ' active' : ''}`
                }
                onClick={onClose}
              >
                <span className="nav-glyph" aria-hidden="true">{item.glyph}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-user-label">Signed in as</span>
        <span className="sidebar-user-name">{userLabel}</span>
        <button type="button" className="btn btn-signout" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </div>
  )
}

export function AppShell({ items, userLabel, children }) {
  const [navOpen, setNavOpen] = useState(false)
  const { logout } = useAuth()

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <header className="topbar">
        <button
          type="button"
          className="topbar-toggle"
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
          aria-label="Open navigation menu"
          onClick={() => setNavOpen((value) => !value)}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <span className="topbar-brand">CampusLedger</span>
      </header>

      {navOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation menu"
          onClick={() => setNavOpen(false)}
        />
      )}

      <Sidebar
        items={items}
        userLabel={userLabel}
        onLogout={() => {
          setNavOpen(false)
          logout()
        }}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <main id="main" className="main">
        {children ?? <Outlet />}
      </main>
    </div>
  )
}

export function AdminShell() {
  const { user } = useAuth()
  const items = [
    { to: '/admin', end: true, label: 'Dashboard', glyph: '◆' },
    { to: '/admin/records', label: 'Student Records', glyph: '§' },
    { to: '/admin/assignments', label: 'Upload Assignment', glyph: '▣' },
    { to: '/admin/students', label: 'Manage Students', glyph: '✎' },
  ]
  return <AppShell items={items} userLabel={user?.email || 'Administrator'} />
}

export function StudentShell() {
  const { user } = useAuth()
  const items = [
    { to: '/student', end: true, label: 'Dashboard', glyph: '◆' },
    { to: '/student/assignments', label: 'My Assignments', glyph: '▣' },
  ]
  return (
    <AppShell
      items={items}
      userLabel={`${user?.name || 'Student'} · ${user?.roll_no || ''}`}
    />
  )
}
