import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  adminLogin,
  binaryParser,
  cookieFrom,
  createHarness,
  createStudent,
  fakePngBuffer,
  studentLogin,
} from './helpers.js'

const CLASS = 'B.Tech'
const SECTION = 'CSE'

function uploadAssignment(h, admin, { title, filename, contentType, buffer, cls = CLASS, section = SECTION }) {
  return request(h.app)
    .post('/api/admin/assignments')
    .set('Cookie', admin)
    .field('title', title)
    .field('class', cls)
    .field('section', section)
    .attach('file', buffer, { filename, contentType })
}

async function createPasswordChangedStudent(h, admin, overrides, newPassword = 'StudentPass2026') {
  const { payload } = await createStudent(h, admin, overrides)
  const temp = h.welcomeCalls.at(-1).tempPassword
  const login = await studentLogin(h, payload.roll_no, temp)
  const cookie = cookieFrom(login)
  const change = await request(h.app)
    .post('/api/auth/student/change-password')
    .set('Cookie', cookie)
    .send({ current_password: temp, new_password: newPassword })
  if (change.status !== 200) throw new Error(`password change failed: ${JSON.stringify(change.body)}`)
  return { payload, cookie }
}

describe('assignments: upload validation, storage and authorized downloads', () => {
  let h
  let admin
  let studentCookieHeader
  let otherSectionCookie
  let assignmentId

  beforeAll(async () => {
    h = createHarness()
    admin = await adminLogin(h)

    const first = await createPasswordChangedStudent(h, admin, {
      roll_no: 'ASG001',
      email: 'asg001@example.com',
      section: 'CSE',
    })
    studentCookieHeader = first.cookie

    const other = await createPasswordChangedStudent(h, admin, {
      roll_no: 'ASG002',
      email: 'asg002@example.com',
      name: 'Other Section Student',
      section: 'AIML',
    })
    otherSectionCookie = other.cookie
  })
  afterAll(() => h.cleanup())

  it('accepts a PNG, stores a safe generated filename and returns metadata', async () => {
    const buffer = fakePngBuffer(256)
    const res = await uploadAssignment(h, admin, {
      title: 'Data Structures Lab',
      filename: 'lab manual.png',
      contentType: 'image/png',
      buffer,
    })
    expect(res.status).toBe(201)
    const meta = res.body.assignment
    expect(meta).toMatchObject({
      title: 'Data Structures Lab',
      class: CLASS,
      section: SECTION,
      original_filename: 'lab manual.png',
      mime_type: 'image/png',
      size_bytes: buffer.length,
    })
    expect(meta.stored_filename).toBeUndefined() // never expose storage internals in list payloads
    assignmentId = meta.id

    const row = h.db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId)
    expect(row.stored_filename).toMatch(/^[a-f0-9]{32}\.png$/)
    expect(row.stored_filename).not.toContain('..')
    expect(row.stored_filename).not.toContain('/')
    const storedPath = path.join(h.uploadsDir, row.stored_filename)
    expect(fs.existsSync(storedPath)).toBe(true)
    expect(fs.readFileSync(storedPath).equals(buffer)).toBe(true)
  })

  it('accepts PDF, DOC and DOCX uploads', async () => {
    const cases = [
      { title: 'Syllabus PDF', filename: 'syllabus.pdf', contentType: 'application/pdf' },
      { title: 'Lab Record', filename: 'record.doc', contentType: 'application/msword' },
      {
        title: 'Project Report',
        filename: 'report.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      { title: 'Diagram', filename: 'diagram.jpeg', contentType: 'image/jpeg' },
    ]
    for (const item of cases) {
      const res = await uploadAssignment(h, admin, { ...item, buffer: Buffer.from('fake-binary-content') })
      expect(res.status, `${item.filename} -> ${JSON.stringify(res.body)}`).toBe(201)
      expect(res.body.assignment.original_filename).toBe(item.filename)
    }
  })

  it('rejects disallowed file types', async () => {
    const res = await uploadAssignment(h, admin, {
      title: 'Malware',
      filename: 'virus.exe',
      contentType: 'application/octet-stream',
      buffer: Buffer.from('MZ evil'),
    })
    expect(res.status).toBe(400)
    expect(res.body.fieldErrors.file).toMatch(/Unsupported file type/i)

    const wrongExt = await uploadAssignment(h, admin, {
      title: 'Mismatch',
      filename: 'notes.txt',
      contentType: 'text/plain',
      buffer: Buffer.from('hello'),
    })
    expect(wrongExt.status).toBe(400)
  })

  it('rejects files over 10 MB with 413', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1024, 0x41)
    const res = await uploadAssignment(h, admin, {
      title: 'Huge File',
      filename: 'huge.png',
      contentType: 'image/png',
      buffer: big,
    })
    expect(res.status).toBe(413)
    expect(res.body.error).toMatch(/10 MB/i)
  })

  it('rejects uploads without a file or with invalid metadata', async () => {
    const noFile = await request(h.app)
      .post('/api/admin/assignments')
      .set('Cookie', admin)
      .field('title', 'No file here')
      .field('class', CLASS)
      .field('section', SECTION)
    expect(noFile.status).toBe(400)
    expect(noFile.body.fieldErrors.file).toBeTruthy()

    const badTitle = await uploadAssignment(h, admin, {
      title: 'x',
      filename: 'ok.pdf',
      contentType: 'application/pdf',
      buffer: Buffer.from('pdf'),
    })
    expect(badTitle.status).toBe(400)
    expect(badTitle.body.fieldErrors.title).toBeTruthy()

    const badSection = await uploadAssignment(h, admin, {
      title: 'Valid title',
      filename: 'ok.pdf',
      contentType: 'application/pdf',
      buffer: Buffer.from('pdf'),
      section: 'Mechanical',
    })
    expect(badSection.status).toBe(400)
    expect(badSection.body.fieldErrors.section).toBeTruthy()
  })

  it('lets the admin download the stored file', async () => {
    const res = await request(h.app)
      .get(`/api/admin/assignments/${assignmentId}/download`)
      .set('Cookie', admin)
      .buffer(true)
      .parse(binaryParser)
    expect(res.status).toBe(200)
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.length).toBe(256)
    expect(res.headers['content-disposition']).toMatch(/attachment/)
    expect(res.headers['content-disposition']).toMatch(/lab manual\.png/)
  })

  it('returns 404 for a missing assignment download', async () => {
    const res = await request(h.app)
      .get('/api/admin/assignments/424242/download')
      .set('Cookie', admin)
    expect(res.status).toBe(404)
  })

  it('lets students download only assignments for their own class and section', async () => {
    const allowed = await request(h.app)
      .get(`/api/student/assignments/${assignmentId}/download`)
      .set('Cookie', studentCookieHeader)
      .buffer(true)
      .parse(binaryParser)
    expect(allowed.status).toBe(200)
    expect(Buffer.isBuffer(allowed.body)).toBe(true)

    const denied = await request(h.app)
      .get(`/api/student/assignments/${assignmentId}/download`)
      .set('Cookie', otherSectionCookie)
    expect(denied.status).toBe(403)
    expect(denied.body.error).toMatch(/not authorized/i)
  })

  it('rejects downloads without a session and unknown ids', async () => {
    const anonymous = await request(h.app).get(`/api/student/assignments/${assignmentId}/download`)
    expect(anonymous.status).toBe(401)

    const unknown = await request(h.app)
      .get('/api/student/assignments/999999/download')
      .set('Cookie', studentCookieHeader)
    expect(unknown.status).toBe(404)
  })

  it('shows students only their own class/section assignments, admins see all', async () => {
    const studentList = await request(h.app)
      .get('/api/student/assignments')
      .set('Cookie', studentCookieHeader)
    expect(studentList.status).toBe(200)
    expect(studentList.body.assignments.length).toBeGreaterThanOrEqual(1)
    expect(studentList.body.assignments.every((a) => a.class === CLASS && a.section === 'CSE')).toBe(true)
    expect(studentList.body.assignments[0].download_url).toMatch(/^\/api\/student\//)

    const otherList = await request(h.app)
      .get('/api/student/assignments')
      .set('Cookie', otherSectionCookie)
    expect(otherList.body.assignments).toHaveLength(0)

    const adminList = await request(h.app).get('/api/admin/assignments').set('Cookie', admin)
    expect(adminList.status).toBe(200)
    expect(adminList.body.assignments.length).toBeGreaterThanOrEqual(5)
    expect(adminList.body.assignments.every((a) => a.download_url.startsWith('/api/admin/'))).toBe(true)
  })

  it('blocks students from admin assignment endpoints', async () => {
    const upload = await uploadAssignment(h, admin, {
      title: 'x',
      filename: 'ok.pdf',
      contentType: 'application/pdf',
      buffer: Buffer.from('pdf'),
      // note: uses admin cookie above; use student cookie here instead
    }).set('Cookie', studentCookieHeader)
    expect(upload.status).toBe(403)

    const list = await request(h.app)
      .get('/api/admin/assignments')
      .set('Cookie', studentCookieHeader)
    expect(list.status).toBe(403)
  })
})
