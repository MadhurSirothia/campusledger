import { useEffect, useId, useRef } from 'react'

function focusableElements(root) {
  return Array.from(
    root.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null || el === document.activeElement)
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
  closeLabel = 'Close dialog',
}) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const generatedId = useId()
  const titleId = `${generatedId}-title`
  const descId = `${generatedId}-desc`

  useEffect(() => {
    if (!open) return undefined

    restoreRef.current = document.activeElement
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    const first = focusableElements(panel)[0]
    ;(first || panel).focus({ preventScroll: true })

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusableElements(panel)
      if (items.length === 0) {
        event.preventDefault()
        panel.focus({ preventScroll: true })
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = ''
      const restore = restoreRef.current
      if (restore && typeof restore.focus === 'function') restore.focus({ preventScroll: true })
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`modal-panel modal-${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descId : undefined}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id={titleId}>
              {title}
            </h2>
            {subtitle && (
              <p className="modal-subtitle" id={descId}>
                {subtitle}
              </p>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
