import path from 'node:path'

const MIME_BY_EXT = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

const CANONICAL_MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export const ALLOWED_EXTENSIONS = Object.keys(MIME_BY_EXT)

const GENERIC_MIMES = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-download'])

export function validateAssignmentFile(file, maxBytes) {
  if (!file || !file.originalname) {
    return { ok: false, error: 'Choose a file to upload.' }
  }
  const ext = path.extname(String(file.originalname)).toLowerCase()
  if (!ext || !MIME_BY_EXT[ext]) {
    return {
      ok: false,
      error: 'Unsupported file type. Allowed types: PDF, PNG, JPG/JPEG, DOC and DOCX.',
    }
  }
  if (typeof file.size === 'number' && file.size > maxBytes) {
    return { ok: false, error: 'File is too large. Maximum size is 10 MB.', tooLarge: true }
  }
  const mime = String(file.mimetype || '').split(';')[0].trim().toLowerCase()
  if (!GENERIC_MIMES.has(mime) && !MIME_BY_EXT[ext].includes(mime)) {
    return {
      ok: false,
      error: `File type mismatch: a "${ext}" file cannot be uploaded as "${mime}".`,
    }
  }
  return {
    ok: true,
    ext,
    mime: GENERIC_MIMES.has(mime) ? CANONICAL_MIME[ext] : mime,
  }
}

export function sanitizeDownloadName(name) {
  const base = path.basename(String(name || '')).replace(/[\r\n\\"]/g, '').trim()
  return base || 'download'
}

export function resolveStoredPath(uploadsDir, storedFilename) {
  const root = path.resolve(uploadsDir)
  const target = path.resolve(root, path.basename(String(storedFilename || '')))
  if (target === root || !target.startsWith(root + path.sep)) return null
  return target
}

export function sendFileDownload(res, uploadsDir, storedFilename, displayName) {
  const target = resolveStoredPath(uploadsDir, storedFilename)
  if (!target) return res.status(404).json({ error: 'File not found.' })
  res.download(target, sanitizeDownloadName(displayName), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File not found on the server.' })
  })
}
