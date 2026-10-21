import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../api.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useToast } from '../toast.jsx'

export default function ManageStudents() {
  const toast = useToast()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [deletePending, setDeletePending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.students()
      setStudents(data.students)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function confirmDelete() {
    if (!confirmTarget) return
    setDeletePending(true)
    setPendingDelete(confirmTarget.id)
    try {
      const data = await adminApi.deleteStudent(confirmTarget.id)
      toast.success(data.message || 'Student deleted.')
      setStudents((list) => list.filter((student) => student.id !== confirmTarget.id))
      setConfirmTarget(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeletePending(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="kicker">Administration</p>
          <h1 className="page-title">Manage students</h1>
          <p className="page-sub">
            Deleting a student removes their account and attendance history. Uploaded assignments
            belong to the class and remain.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-ghost" to="/admin">
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="card" aria-label="Student list">
        {loading && <p className="empty-note" role="status">Loading students…</p>}
        {!loading && error && (
          <div className="inline-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && students.length === 0 && (
          <div className="empty-state">
            <p className="empty-title">No students yet</p>
            <p>Add your first student from the dashboard.</p>
            <Link className="btn btn-navy" to="/admin">
              Go to dashboard
            </Link>
          </div>
        )}
        {!loading && !error && students.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">All students</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Roll number</th>
                  <th scope="col">Class</th>
                  <th scope="col">Section</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="cell-name">
                      {student.name}
                      {student.must_change_password && (
                        <span className="chip chip-unmarked chip-sm" title="Temporary password not changed yet">
                          temp password
                        </span>
                      )}
                    </td>
                    <td className="cell-roll">{student.roll_no}</td>
                    <td>{student.class}</td>
                    <td>{student.section}</td>
                    <td className="cell-email">{student.email}</td>
                    <td>{student.phone}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setConfirmTarget(student)}
                        aria-label={`Delete ${student.name}`}
                        disabled={pendingDelete === student.id}
                      >
                        {pendingDelete === student.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        danger
        pending={deletePending}
        title="Delete student?"
        body={
          confirmTarget
            ? `${confirmTarget.name} (${confirmTarget.roll_no}) will be removed along with all of their attendance records. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete student"
        cancelLabel="Cancel"
        onCancel={() => setConfirmTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
