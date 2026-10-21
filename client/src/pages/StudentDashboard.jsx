import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { studentApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import Modal from '../components/Modal.jsx'
import StatusChip from '../components/StatusChip.jsx'
import { firstName, formatDateHuman, todayISO } from '../utils.js'

function AttendanceModal({ open, onClose }) {
  const [tab, setTab] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await studentApi.attendance()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setTab('today')
      load()
    }
  }, [open, load])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="My attendance"
      subtitle="Today's mark and your term record."
      width="md"
      footer={
        <button type="button" className="btn btn-navy" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="tabs" role="tablist" aria-label="Attendance views">
        <button
          type="button"
          role="tab"
          id="tab-today"
          aria-selected={tab === 'today'}
          aria-controls="panel-today"
          className={`tab${tab === 'today' ? ' active' : ''}`}
          onClick={() => setTab('today')}
        >
          Today attendance
        </button>
        <button
          type="button"
          role="tab"
          id="tab-total"
          aria-selected={tab === 'total'}
          aria-controls="panel-total"
          className={`tab${tab === 'total' ? ' active' : ''}`}
          onClick={() => setTab('total')}
        >
          Total attendance
        </button>
      </div>

      {loading && <p className="empty-note" role="status">Loading attendance…</p>}
      {!loading && error && (
        <div className="inline-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && tab === 'today' && (
        <div
          className="tab-panel"
          role="tabpanel"
          id="panel-today"
          aria-labelledby="tab-today"
          tabIndex={0}
        >
          <p className="today-date">{formatDateHuman(data.today.date)}</p>
          {data.today.status ? (
            <div className="today-status">
              <StatusChip status={data.today.status} size="lg" />
              <p>
                You are marked <strong>{data.today.status === 'present' ? 'present' : 'absent'}</strong> for{' '}
                {formatDateHuman(data.today.date)}.
              </p>
            </div>
          ) : (
            <div className="today-status">
              <span className="chip chip-unmarked chip-lg">Not marked yet</span>
              <p>The administrator has not recorded attendance for {formatDateHuman(data.today.date)}.</p>
            </div>
          )}
        </div>
      )}

      {!loading && !error && data && tab === 'total' && (
        <div
          className="tab-panel"
          role="tabpanel"
          id="panel-total"
          aria-labelledby="tab-total"
          tabIndex={0}
        >
          <div className="mini-stats">
            <div className="mini-stat">
              <span className="mini-value">{data.totals.present_days}</span>
              <span className="mini-label">Present days</span>
            </div>
            <div className="mini-stat">
              <span className="mini-value">{data.totals.marked_days}</span>
              <span className="mini-label">Marked days</span>
            </div>
            <div className="mini-stat">
              <span className="mini-value">{data.totals.percentage}%</span>
              <span className="mini-label">Attendance</span>
            </div>
          </div>

          {data.records.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No attendance recorded yet</p>
              <p>Your records will appear here once attendance is taken.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Recent attendance records</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((record) => (
                    <tr key={record.date}>
                      <td>{formatDateHuman(record.date)}</td>
                      <td>
                        <StatusChip status={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await studentApi.overview()
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
          <h1 className="page-title">Good day, {firstName(user?.name)}</h1>
          <p className="page-sub">
            {user?.roll_no} · {user?.class} · {user?.section}
          </p>
        </div>
      </header>

      {loading && (
        <section className="stat-grid" aria-label="Summary">
          <div className="stat-card skeleton" aria-hidden="true" />
          <div className="stat-card skeleton" aria-hidden="true" />
          <div className="stat-card skeleton" aria-hidden="true" />
        </section>
      )}

      {!loading && error && (
        <div className="inline-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && overview && (
        <section className="stat-grid" aria-label="Summary">
          <div className="stat-card">
            <span className="stat-value stat-status">
              {overview.attendance.today_status ? (
                <StatusChip status={overview.attendance.today_status} size="lg" />
              ) : (
                <span className="chip chip-unmarked chip-lg">Not marked yet</span>
              )}
            </span>
            <span className="stat-label">Today attendance</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{overview.attendance.percentage}%</span>
            <span className="stat-label">
              Overall ({overview.attendance.present_days}/{overview.attendance.marked_days} days present)
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{overview.assignments_count}</span>
            <span className="stat-label">Assignments for {overview.student.section}</span>
          </div>
        </section>
      )}

      <section className="section-block" aria-labelledby="student-actions-heading">
        <div className="section-head">
          <h2 id="student-actions-heading" className="section-title">
            What would you like to do?
          </h2>
          <div className="section-rule" aria-hidden="true" />
        </div>

        <div className="action-grid action-grid-2">
          <button type="button" className="action-card" onClick={() => setAttendanceOpen(true)}>
            <span className="action-glyph" aria-hidden="true">✓</span>
            <span className="action-name">Show my attendance</span>
            <span className="action-desc">View today's status and your total attendance record.</span>
          </button>
          <Link className="action-card" to="/student/assignments">
            <span className="action-glyph" aria-hidden="true">▣</span>
            <span className="action-name">My assignments</span>
            <span className="action-desc">
              {overview
                ? `${overview.assignments_count} file(s) shared with ${overview.student.class} ${overview.student.section}.`
                : 'Download files shared with your class and section.'}
            </span>
          </Link>
        </div>
      </section>

      <AttendanceModal open={attendanceOpen} onClose={() => setAttendanceOpen(false)} />
    </div>
  )
}
