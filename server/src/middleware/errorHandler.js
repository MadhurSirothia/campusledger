export function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE')) {
    return res.status(413).json({
      error: 'File is too large. Maximum size is 10 MB.',
      fieldErrors: { file: 'Maximum file size is 10 MB.' },
    })
  }
  if (err && err.name === 'MulterError') {
    return res.status(400).json({
      error: err.message || 'File upload failed.',
      fieldErrors: { file: err.message || 'File upload failed.' },
    })
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload.' })
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large.' })
  }
  if (err && err.status) {
    return res.status(err.status).json({ error: err.message || 'Request failed.' })
  }

  console.error('[CampusLedger] Unhandled error:', err)
  return res.status(500).json({ error: 'Something went wrong on the server.' })
}
