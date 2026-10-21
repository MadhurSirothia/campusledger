export const studentColumns =
  'id, name, roll_no, phone, email, class, section, must_change_password, created_at'

export function publicStudent(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    roll_no: row.roll_no,
    phone: row.phone,
    email: row.email,
    class: row.class,
    section: row.section,
    must_change_password: Boolean(row.must_change_password),
    created_at: row.created_at,
  }
}

export function publicAssignment(row, downloadUrl) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    class: row.class,
    section: row.section,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    uploaded_at: row.uploaded_at,
    uploaded_date: String(row.uploaded_at || '').slice(0, 10),
    download_url: downloadUrl,
  }
}
