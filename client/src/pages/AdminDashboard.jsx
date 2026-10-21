import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import AddStudentModal from '../components/AddStudentModal.jsx'
import TakeAttendanceModal from '../components/TakeAttendanceModal.jsx'
import { firstName, formatDateHuman, todayISO } from '../utils.js'

function StatCard({ label, value, tone }) {
  return (
    <div className={`stat-card${tone ? ` stat-${tone}` : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.overview()
      setOverview(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="kicker">{formatDateHuman(todayISO())}</p>
          <h1 className="page-title">Administrator dashboard</h1>
          <p className="page-sub">
            Welcome back{user?.name ? `, ${firstName(user.name)}` : ''}. The register is ready.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-gold" onClick={() => setAttendanceOpen(true)}>
            Take attendance
          </button>
          <button type="button" className="btn btn-navy" onClick={() => setAddOpen(true)}>
            Add student
          </button>
        </div>
      </header>

      <section aria-label="Summary" className="stat-grid">
        {loading && (
          <>
            <div className="stat-card skeleton" aria-hidden="true" />
            <div className="stat-card skeleton" aria-hidden="true" />
            <div className="stat-card skeleton" aria-hidden="true" />
            <div className="stat-card skeleton" aria-hidden="true" />
          </>
        )}
        {!loading && overview && (
          <>
            <StatCard label="Total students" value={overview.total_students} />
            <StatCard label="Present today" value={overview.present_today} tone="present" />
            <StatCard label="Absent today" value={overview.absent_today} tone="absent" />
            <StatCard label="Assignments" value={overview.assignments} />
          </>
        )}
        {!loading && error && (
          <div className="inline-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
              Retry
            </button>
          </div>
        )}
      </section>

      <section className="section-block" aria-labelledby="quick-actions-heading">
        <div className="section-head">
          <h2 id="quick-actions-heading" className="section-title">
            Quick actions
          </h2>
          <div className="section-rule" aria-hidden="true" />
        </div>

        <div className="action-grid">
          <button type="button" className="action-card" onClick={() => setAddOpen(true)}>
            <span className="action-glyph" aria-hidden="true">＋</span>
            <span className="action-name">Add student</span>
            <span className="action-desc">Create an account and email the temporary password.</span>
          </button>
          <button type="button" className="action-card" onClick={() => setAttendanceOpen(true)}>
            <span className="action-glyph" aria-hidden="true">✓</span>
            <span className="action-name">Take attendance</span>
            <span className="action-desc">Mark a roster present or absent, then notify everyone.</span>
          </button>
          <Link className="action-card" to="/admin/records">
            <span className="action-glyph" aria-hidden="true">§</span>
            <span className="action-name">Show student records</span>
            <span className="action-desc">Filter by class, section and date with totals.</span>
          </Link>
          <Link className="action-card" to="/admin/assignments">
            <span className="action-glyph" aria-hidden="true">▣</span>
            <span className="action-name">Upload assignment</span>
            <span className="action-desc">Share a PDF, image or document with a class section.</span>
          </Link>
        </div>
      </section>

      <div className="bottom-action">
        <div className="bottom-action-copy">
          <h2 className="bottom-action-title">Manage &amp; delete students</h2>
          <p>Review every student record, or remove a student and their attendance history.</p>
        </div>
        <Link className="btn btn-ghost" to="/admin/students">
          Open student management →
        </Link>
      </div>

      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
      <TakeAttendanceModal open={attendanceOpen} onClose={() => setAttendanceOpen(false)} onSaved={load} />
    </div>
  )
}
