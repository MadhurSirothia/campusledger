import { statusLabel } from '../utils.js'

export default function StatusChip({ status, size = 'md' }) {
  let tone = 'unmarked'
  if (status === 'present') tone = 'present'
  else if (status === 'absent') tone = 'absent'
  return (
    <span className={`chip chip-${tone}${size === 'lg' ? ' chip-lg' : ''}`}>
      {statusLabel(status)}
    </span>
  )
}
