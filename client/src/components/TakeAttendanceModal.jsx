import { useEffect, useState } from 'react'
import { adminApi } from '../api.js'
import Modal from '../components/Modal.jsx'
import { FormBanner, SelectField, TextField } from '../components/Field.jsx'
import StatusChip from '../components/StatusChip.jsx'
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../constants.js'
import { todayISO, formatDateHuman } from '../utils.js'
import { useToast } from '../toast.jsx'

export default function TakeAttendanceModal({ open, onClose, onSaved }) {
  const toast = useToast()
  const [cls, setCls] = useState('B.Tech')
  const [section, setSection] = useState('CSE')
  const [date, setDate] = useState(todayISO())
  const [phase, setPhase] = useState('select')
  const [roster, setRoster] = useState([])
  const [marks, setMarks] = useState({})
  const [hadExisting, setHadExisting] = useState(false)
  const [banner, setBanner] = useState(null)
  const [loadPending, setLoadPending] = useState(false)
  const [savePending, setSavePending] = useState(false)

  useEffect(() => {
    if (!open) {
      setPhase('select')
      setRoster([])
      setMarks({})
      setHadExisting(false)
      setBanner(null)
      setDate(todayISO())
    }
  }, [open])

  function resetSelection() {
    setPhase('select')
    setRoster([])
    setMarks({})
    setHadExisting(false)
    setBanner(null)
  }

  async function loadRoster() {
    setBanner(null)
    setLoadPending(true)
    try {
      const data = await adminApi.attendance({ class: cls, section, date })
      setRoster(data.students)
      const initial = {}
      for (const student of data.students) initial[student.id] = student.status || 'present'
      setMarks(initial)
      setHadExisting(data.students.some((student) => student.status))
      setPhase('roster')
      if (data.students.length === 0) {
        setBanner('No students are enrolled in this class and section yet.')
      }
    } catch (err) {
      setBanner(err.message)
    } finally {
      setLoadPending(false)
    }
  }

  function setAll(status) {
    const next = {}
    for (const student of roster) next[student.id] = status
    setMarks(next)
  }

  const presentCount = roster.filter((student) => marks[student.id] === 'present').length
  const absentCount = roster.length - presentCount

  async function save() {
    if (roster.length === 0) return
    setBanner(null)
    setSavePending(true)
    try {
      const data = await adminApi.saveAttendance({
        class: cls,
        section,
        date,
        records: roster.map((student) => ({ student_id: student.id, status: marks[student.id] || 'present' })),
      })
      toast.success(
        `Attendance saved for ${formatDateHuman(date)} — ${data.saved} students, emails sent ${data.emails.sent}, failed ${data.emails.failed}.`
      )
      if (data.emails.failed > 0) {
        toast.error(`${data.emails.failed} attendance email(s) could not be sent. Check SMTP settings on the server.`)
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setBanner(err.message)
    } finally {
      setSavePending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={savePending ? () => {} : onClose}
      title="Take attendance"
      subtitle="Choose a class, section and date, then review the roster before saving."
      width="lg"
      footer={
        phase === 'roster' ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={resetSelection} disabled={savePending}>
              Change selection
            </button>
            <button type="button" className="btn btn-gold" onClick={save} disabled={savePending || roster.length === 0}>
              {savePending ? 'Saving…' : 'Save attendance'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loadPending}>
              Cancel
            </button>
            <button type="button" className="btn btn-navy" onClick={loadRoster} disabled={loadPending}>
              {loadPending ? 'Loading…' : 'Load roster'}
            </button>
          </>
        )
      }
    >
      <FormBanner>{banner}</FormBanner>

      <div className="form-grid-3">
        <SelectField
          id="att-class"
          label="Class"
          options={CLASS_OPTIONS}
          value={cls}
          disabled={phase === 'roster'}
          onChange={(event) => {
            setCls(event.target.value)
            resetSelection()
          }}
        />
        <SelectField
          id="att-section"
          label="Section"
          options={SECTION_OPTIONS}
          value={section}
          disabled={phase === 'roster'}
          onChange={(event) => {
            setSection(event.target.value)
            resetSelection()
          }}
        />
        <TextField
          id="att-date"
          label="Date"
          type="date"
          value={date}
          disabled={phase === 'roster'}
          onChange={(event) => {
            setDate(event.target.value)
            resetSelection()
          }}
        />
      </div>

      {phase === 'roster' && (
        <>
          <div className="roster-toolbar">
            <div className="roster-shortcuts" role="group" aria-label="Bulk attendance shortcuts">
              <button type="button" className="btn btn-sm btn-present" onClick={() => setAll('present')}>
                Mark all present
              </button>
              <button type="button" className="btn btn-sm btn-absent" onClick={() => setAll('absent')}>
                Mark all absent
              </button>
            </div>
            <p className="roster-summary" aria-live="polite">
              <strong>{presentCount}</strong> present · <strong>{absentCount}</strong> absent ·{' '}
              <strong>{roster.length}</strong> total
            </p>
          </div>

          {hadExisting && (
            <div className="warning-box warning-inline" role="alert">
              <p className="warning-title">Attendance was already saved for {formatDateHuman(date)}.</p>
              <p>Saving again will update the records and re-send attendance emails to every student in this class and section.</p>
            </div>
          )}

          {roster.length === 0 ? (
            <p className="empty-note">No students found for {cls} {section}.</p>
          ) : (
            <div className="table-wrap roster-table-wrap">
              <table className="table roster-table">
                <caption className="visually-hidden">
                  Roster for {cls} {section} on {formatDateHuman(date)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Student</th>
                    <th scope="col">Roll number</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((student, index) => {
                    const value = marks[student.id] || 'present'
                    return (
                      <tr key={student.id}>
                        <td className="cell-index">{index + 1}</td>
                        <td className="cell-name">{student.name}</td>
                        <td className="cell-roll">{student.roll_no}</td>
                        <td>
                          <div className="toggle-group" role="group" aria-label={`Attendance for ${student.name}`}>
                            <button
                              type="button"
                              className={`toggle present${value === 'present' ? ' on' : ''}`}
                              aria-pressed={value === 'present'}
                              onClick={() => setMarks((prev) => ({ ...prev, [student.id]: 'present' }))}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              className={`toggle absent${value === 'absent' ? ' on' : ''}`}
                              aria-pressed={value === 'absent'}
                              onClick={() => setMarks((prev) => ({ ...prev, [student.id]: 'absent' }))}
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="form-note">
            Saving emails every student in {cls} {section} — present and absent alike.
          </p>
        </>
      )}

      {phase === 'select' && (
        <div className="roster-placeholder">
          <p>Select a class, section and date, then load the roster.</p>
          <p className="roster-placeholder-status">
            <StatusChip status={null} size="lg" />
          </p>
        </div>
      )}
    </Modal>
  )
}
