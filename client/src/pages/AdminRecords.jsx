import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../api.js'
import StatusChip from '../components/StatusChip.jsx'
import { SelectField, TextField } from '../components/Field.jsx'
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../constants.js'
import { formatDateHuman, todayISO } from '../utils.js'

export default function AdminRecords() {
  const [cls, setCls] = useState('B.Tech')
  const [section, setSection] = useState('CSE')
  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminApi.attendance({ class: cls, section, date })
      setData(result)
    } catch (err) {
      setError(err.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [cls, section, date])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="kicker">Register</p>
          <h1 className="page-title">Student records</h1>
          <p className="page-sub">Present, absent or not marked — filtered by class, section and date.</p>
        </div>
      </header>

      <section className="card filter-card" aria-label="Record filters">
        <div className="form-grid-3">
          <SelectField
            id="records-class"
            label="Class"
            options={CLASS_OPTIONS}
            value={cls}
            onChange={(event) => setCls(event.target.value)}
          />
          <SelectField
            id="records-section"
            label="Section"
            options={SECTION_OPTIONS}
            value={section}
            onChange={(event) => setSection(event.target.value)}
          />
          <TextField
            id="records-date"
            label="Date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </section>

      {data && (
        <div className="count-bar" role="status" aria-live="polite">
          <span className="count-item count-present">
            <strong>{data.counts.present}</strong> present
          </span>
          <span className="count-item count-absent">
            <strong>{data.counts.absent}</strong> absent
          </span>
          <span className="count-item count-unmarked">
            <strong>{data.counts.unmarked}</strong> not marked
          </span>
          <span className="count-item count-total">
            <strong>{data.counts.total}</strong> total
          </span>
        </div>
      )}

      <section className="card" aria-label="Attendance records">
        {loading && <p className="empty-note" role="status">Loading records…</p>}
        {!loading && error && (
          <div className="inline-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && data && data.students.length === 0 && (
          <div className="empty-state">
            <p className="empty-title">No students in {cls} {section}</p>
            <p>Add students from the dashboard to build this roster.</p>
          </div>
        )}
        {!loading && !error && data && data.students.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                Attendance for {cls} {section} on {formatDateHuman(date)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Name</th>
                  <th scope="col">Roll number</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((student, index) => (
                  <tr key={student.id}>
                    <td className="cell-index">{index + 1}</td>
                    <td className="cell-name">{student.name}</td>
                    <td className="cell-roll">{student.roll_no}</td>
                    <td>
                      <StatusChip status={student.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
