import { useState } from 'react'
import { adminApi } from '../api.js'
import Modal from '../components/Modal.jsx'
import { FormBanner, SelectField, TextField } from '../components/Field.jsx'
import { Crest } from '../components/AppShell.jsx'
import { useToast } from '../toast.jsx'
import { CLASSES, SECTIONS } from '../constants.js'

const EMPTY_FORM = { name: '', roll_no: '', phone: '', email: '', class: 'B.Tech', section: 'CSE' }

function validate(form) {
  const errors = {}
  if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
  if (!form.roll_no.trim()) errors.roll_no = 'Roll number is required.'
  else if (!/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(form.roll_no.trim()))
    errors.roll_no = 'Use letters, numbers, "-", "_" or "/" only.'
  if (!form.phone.trim()) errors.phone = 'Phone number is required.'
  else if (form.phone.replace(/\D/g, '').length < 6 || form.phone.replace(/\D/g, '').length > 15)
    errors.phone = 'Enter a phone number with 6 to 15 digits.'
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  return errors
}

export default function AddStudentModal({ open, onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState(null)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  function reset() {
    setForm(EMPTY_FORM)
    setErrors({})
    setBanner(null)
    setResult(null)
  }

  function handleClose() {
    if (pending) return
    reset()
    onClose()
  }

  async function onSubmit(event) {
    event.preventDefault()
    setBanner(null)
    const clientErrors = validate(form)
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }
    setErrors({})
    setPending(true)
    try {
      const data = await adminApi.createStudent({
        name: form.name.trim(),
        roll_no: form.roll_no.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        class: form.class,
        section: form.section,
      })
      setResult(data)
      toast.success(`${data.student.name} was added to ${form.class} ${form.section}.`)
      onCreated?.()
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }))
      }
      setBanner(err.message)
    } finally {
      setPending(false)
    }
  }

  const classOptions = CLASSES.map((value) => ({ value, label: value }))
  const sectionOptions = SECTIONS.map((value) => ({ value, label: value }))

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={result ? 'Student added' : 'Add student'}
      subtitle={
        result
          ? undefined
          : 'Create a student account. A temporary password will be generated and emailed.'
      }
      width="md"
      footer={
        result ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Add another student
            </button>
            <button type="button" className="btn btn-navy" onClick={handleClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form="add-student-form" className="btn btn-gold" disabled={pending}>
              {pending ? 'Saving…' : 'Save student'}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="success-panel">
          <p className="success-lead">
            <strong>{result.student.name}</strong> ({result.student.roll_no}) now has a student
            account in {result.student.class} {result.student.section}.
          </p>
          <p className="success-line">{result.message}</p>

          {result.temp_password ? (
            <div className="warning-box" role="alert">
              <p className="warning-title">{result.email_warning}</p>
              <dl className="credential-list">
                <div>
                  <dt>Roll number</dt>
                  <dd>{result.student.roll_no}</dd>
                </div>
                <div>
                  <dt>Temporary password</dt>
                  <dd className="credential-value">{result.temp_password}</dd>
                </div>
                <div>
                  <dt>Login URL</dt>
                  <dd className="credential-value">{`${window.location.origin}/student/login`}</dd>
                </div>
              </dl>
              <p className="warning-note">
                This password is shown once and is never stored in plain text.
              </p>
            </div>
          ) : (
            <div className="info-box">
              <p>
                Welcome email sent to <strong>{result.student.email}</strong> with the roll number,
                temporary password and login link. The student must change the password at first
                sign-in.
              </p>
            </div>
          )}
        </div>
      ) : (
        <form id="add-student-form" onSubmit={onSubmit} noValidate>
          <FormBanner>{banner}</FormBanner>
          <div className="form-grid-2">
            <TextField
              id="student-name"
              label="Full name"
              required
              autoComplete="off"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              error={errors.name}
            />
            <TextField
              id="student-roll"
              label="Roll number"
              required
              autoComplete="off"
              placeholder="e.g. 21B81A0001"
              value={form.roll_no}
              onChange={(event) => update('roll_no', event.target.value)}
              error={errors.roll_no}
            />
            <TextField
              id="student-phone"
              label="Phone number"
              type="tel"
              required
              autoComplete="off"
              placeholder="e.g. 9876543210"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              error={errors.phone}
            />
            <TextField
              id="student-email"
              label="Email address"
              type="email"
              required
              autoComplete="off"
              placeholder="student@example.com"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              error={errors.email}
            />
            <SelectField
              id="student-class"
              label="Class"
              required
              options={classOptions}
              value={form.class}
              onChange={(event) => update('class', event.target.value)}
              error={errors.class}
            />
            <SelectField
              id="student-section"
              label="Section"
              required
              options={sectionOptions}
              value={form.section}
              onChange={(event) => update('section', event.target.value)}
              error={errors.section}
            />
          </div>
          <p className="form-note">
            <Crest size="xs" aria-hidden="true" /> A secure temporary password is generated for
            every student and sent by email.
          </p>
        </form>
      )}
    </Modal>
  )
}
