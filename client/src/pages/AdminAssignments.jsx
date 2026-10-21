import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '../api.js'
import { FormBanner, SelectField, TextField } from '../components/Field.jsx'
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../constants.js'
import { fileExtension, formatBytes, formatDateHuman } from '../utils.js'
import { useToast } from '../toast.jsx'

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx']
const MAX_BYTES = 10 * 1024 * 1024

export default function AdminAssignments() {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [title, setTitle] = useState('')
  const [cls, setCls] = useState('B.Tech')
  const [section, setSection] = useState('CSE')
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [pending, setPending] = useState(false)

  const [assignments, setAssignments] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)

  const load = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const data = await adminApi.assignments()
      setAssignments(data.assignments)
    } catch (err) {
      setListError(err.message)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function onFileChange(event) {
    const chosen = event.target.files && event.target.files[0] ? event.target.files[0] : null
    setErrors((prev) => ({ ...prev, file: undefined }))
    setBanner(null)
    if (!chosen) {
      setFile(null)
      return
    }
    const extension = (chosen.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setFile(null)
      event.target.value = ''
      setErrors((prev) => ({
        ...prev,
        file: 'Unsupported file type. Allowed: PDF, PNG, JPG/JPEG, DOC, DOCX.',
      }))
      return
    }
    if (chosen.size > MAX_BYTES) {
      setFile(null)
      event.target.value = ''
      setErrors((prev) => ({ ...prev, file: 'File is too large. Maximum size is 10 MB.' }))
      return
    }
    setFile(chosen)
  }

  async function onSubmit(event) {
    event.preventDefault()
    setBanner(null)
    const nextErrors = {}
    if (title.trim().length < 3) nextErrors.title = 'Title must be at least 3 characters.'
    if (!file) nextErrors.file = 'Choose a file to upload.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setPending(true)
    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('class', cls)
      formData.append('section', section)
      formData.append('file', file)
      const data = await adminApi.uploadAssignment(formData)
      toast.success(`"${data.assignment.title}" uploaded for ${cls} ${section}.`)
      setTitle('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }))
      }
      setBanner(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="kicker">Coursework</p>
          <h1 className="page-title">Upload assignment</h1>
          <p className="page-sub">
            One file per assignment — PDF, PNG, JPG/JPEG, DOC or DOCX, up to 10 MB.
          </p>
        </div>
      </header>

      <div className="two-col">
        <section className="card" aria-labelledby="upload-form-heading">
          <h2 id="upload-form-heading" className="card-title">
            New assignment
          </h2>
          <form onSubmit={onSubmit} noValidate>
            <FormBanner>{banner}</FormBanner>
            <TextField
              id="assignment-title"
              label="Title"
              required
              placeholder="e.g. Week 5 - Linked Lists Lab"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={errors.title}
            />
            <div className="form-grid-2">
              <SelectField
                id="assignment-class"
                label="Class"
                options={CLASS_OPTIONS}
                value={cls}
                onChange={(event) => setCls(event.target.value)}
                error={errors.class}
              />
              <SelectField
                id="assignment-section"
                label="Section"
                options={SECTION_OPTIONS}
                value={section}
                onChange={(event) => setSection(event.target.value)}
                error={errors.section}
              />
            </div>

            <div className={`field${errors.file ? ' field-invalid' : ''}`}>
              <span className="field-label" id="assignment-file-label">
                File <span className="req" aria-hidden="true">*</span>
              </span>
              <div className="file-row">
                <label className="btn btn-ghost file-button" htmlFor="assignment-file">
                  Choose file
                  <input
                    id="assignment-file"
                    ref={fileInputRef}
                    type="file"
                    className="visually-hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    aria-labelledby="assignment-file-label"
                    aria-invalid={errors.file ? 'true' : undefined}
                    aria-describedby={errors.file ? 'assignment-file-message' : undefined}
                    onChange={onFileChange}
                  />
                </label>
                <span className="file-name" aria-live="polite">
                  {file
                    ? `${file.name} · ${formatBytes(file.size)}`
                    : 'No file chosen'}
                </span>
              </div>
              {errors.file && (
                <p className="field-message" id="assignment-file-message">
                  {errors.file}
                </p>
              )}
            </div>

            <button type="submit" className="btn btn-gold btn-block" disabled={pending}>
              {pending ? 'Uploading…' : 'Upload assignment'}
            </button>
          </form>
        </section>

        <section className="card" aria-labelledby="uploads-heading">
          <div className="card-head-row">
            <h2 id="uploads-heading" className="card-title">
              Uploaded assignments
            </h2>
            <span className="card-count">{assignments.length} total</span>
          </div>

          {listLoading && <p className="empty-note" role="status">Loading assignments…</p>}
          {!listLoading && listError && (
            <div className="inline-error" role="alert">
              <p>{listError}</p>
              <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
                Retry
              </button>
            </div>
          )}
          {!listLoading && !listError && assignments.length === 0 && (
            <div className="empty-state">
              <p className="empty-title">No assignments yet</p>
              <p>Uploaded files will appear here for every class and section.</p>
            </div>
          )}
          {!listLoading && !listError && assignments.length > 0 && (
            <ul className="assignment-list">
              {assignments.map((item) => (
                <li key={item.id} className="assignment-row">
                  <div className="assignment-copy">
                    <h3 className="assignment-title">{item.title}</h3>
                    <p className="assignment-meta">
                      {item.class} {item.section} · {formatDateHuman(item.uploaded_date)} ·{' '}
                      {fileExtension(item.original_filename)} · {formatBytes(item.size_bytes)}
                    </p>
                  </div>
                  <a
                    className="btn btn-sm btn-navy"
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
    </div>
  )
}
