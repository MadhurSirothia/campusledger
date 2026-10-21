import { useId } from 'react'

export function TextField({ id, label, error, hint, required = false, className = '', ...inputProps }) {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = error ? `${fieldId}-message` : hint ? `${fieldId}-hint` : undefined
  return (
    <div className={`field ${className}`.trim()}>
      <label className="field-label" htmlFor={fieldId}>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      <input
        id={fieldId}
        className="input"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...inputProps}
      />
      {hint && !error && (
        <p className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-message" id={`${fieldId}-message`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function SelectField({ id, label, options, error, hint, required = false, className = '', ...selectProps }) {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = error ? `${fieldId}-message` : hint ? `${fieldId}-hint` : undefined
  return (
    <div className={`field ${className}`.trim()}>
      <label className="field-label" htmlFor={fieldId}>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      <select
        id={fieldId}
        className="input select"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-message" id={`${fieldId}-message`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function FormBanner({ type = 'error', children }) {
  if (!children) return null
  return (
    <p className={`form-banner form-banner-${type}`} role="alert">
      {children}
    </p>
  )
}
