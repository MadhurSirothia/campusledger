import Modal from './Modal.jsx'

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onCancel}
      title={title}
      width="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-body">{body}</p>
    </Modal>
  )
}
