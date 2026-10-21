const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function pad2(value) {
  return String(value).padStart(2, '0')
}

export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function formatDateHuman(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || ''
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!MONTHS[month - 1]) return isoDate
  return `${day} ${MONTHS[month - 1]} ${year}`
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= 1024) return `${Math.round(size / 1024)} KB`
  return `${size} B`
}

export function fileExtension(name) {
  const match = /\.([a-z0-9]+)$/i.exec(name || '')
  return match ? match[1].toUpperCase() : 'FILE'
}

export function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || 'there'
}

export function statusLabel(status) {
  if (status === 'present') return 'Present'
  if (status === 'absent') return 'Absent'
  return 'Not marked'
}
