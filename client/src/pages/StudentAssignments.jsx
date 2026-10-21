import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { studentApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { fileExtension, formatBytes, formatDateHuman } from '../utils.js'

export default function StudentAssignments() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await studentApi.assignments()
      setAssignments(data.assignments)
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
          <p className="kicker">Coursework</p>
          <h1 className="page-title">My assignments</h1>
          <p className="page-sub">
            Files shared with {user?.class} {user?.section} only.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-ghost" to="/student">
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="card" aria-label="Assignments for your class">
        {loading && <p className="empty-note" role="status">Loading assignments…</p>}
        {!loading && error && (
          <div className="inline-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && assignments.length === 0 && (
          <div className="empty-state">
            <p className="empty-title">No assignments yet</p>
            <p>When your administrator uploads a file for {user?.class} {user?.section}, it will appear here.</p>
          </div>
        )}
        {!loading && !error && assignments.length > 0 && (
          <ul className="assignment-list">
            {assignments.map((item) => (
              <li key={item.id} className="assignment-row">
                <div className="assignment-copy">
                  <h2 className="assignment-title">{item.title}</h2>
                  <p className="assignment-meta">
                    Uploaded {formatDateHuman(item.uploaded_date)} · {fileExtension(item.original_filename)} ·{' '}
                    {formatBytes(item.size_bytes)}
                  </p>
                </div>
                <a
                  className="btn btn-sm btn-gold"
                  href={item.download_url}
                  aria-label={`Download ${item.title}`}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
