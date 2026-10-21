export class ApiError extends Error {
  constructor(status, message, fieldErrors = null, code = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors || {}
    this.code = code
  }
}

async function handleResponse(res) {
  let data = null
  try {
    data = await res.json()
  } catch {
    /* response had no JSON body */
  }
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('campusledger:unauthorized'))
    }
    throw new ApiError(
      res.status,
      (data && data.error) || `Request failed (${res.status})`,
      data && data.fieldErrors,
      data && data.code
    )
  }
  return data
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse(res)
}

export async function apiUpload(path, formData) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  return handleResponse(res)
}

export const authApi = {
  adminLogin: (payload) => api('/api/auth/admin/login', { method: 'POST', body: payload }),
  studentLogin: (payload) => api('/api/auth/student/login', { method: 'POST', body: payload }),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
  me: () => api('/api/auth/me'),
  changePassword: (payload) => api('/api/auth/student/change-password', { method: 'POST', body: payload }),
}

export const adminApi = {
  overview: () => api('/api/admin/overview'),
  students: () => api('/api/admin/students'),
  createStudent: (payload) => api('/api/admin/students', { method: 'POST', body: payload }),
  deleteStudent: (id) => api(`/api/admin/students/${id}`, { method: 'DELETE' }),
  attendance: (query) => {
    const params = new URLSearchParams(query)
    return api(`/api/admin/attendance?${params.toString()}`)
  },
  saveAttendance: (payload) => api('/api/admin/attendance', { method: 'PUT', body: payload }),
  assignments: () => api('/api/admin/assignments'),
  uploadAssignment: (formData) => apiUpload('/api/admin/assignments', formData),
}

export const studentApi = {
  overview: () => api('/api/student/overview'),
  attendance: () => api('/api/student/attendance'),
  assignments: () => api('/api/student/assignments'),
}
