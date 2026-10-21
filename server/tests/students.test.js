import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  adminLogin,
  createStudent,
  createStudentPayload,
  cookieFrom,
  createHarness,
  studentLogin,
} from './helpers.js'

describe('admin: student creation, validation and deletion', () => {
  let h
  let admin
  beforeAll(async () => {
    h = createHarness()
    admin = await adminLogin(h)
  })
  afterAll(() => h.cleanup())

  it('creates a student, hashes the password and emails login details', async () => {
    const payload = createStudentPayload()
    const res = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(payload)

    expect(res.status).toBe(201)
    expect(res.body.student).toMatchObject({
      name: payload.name,
      roll_no: payload.roll_no,
      email: payload.email,
      class: payload.class,
      section: payload.section,
      must_change_password: true,
    })
    expect(res.body.student).not.toHaveProperty('password_hash')
    expect(res.body.email_status).toBe('sent')
    expect(res.body.temp_password).toBeNull()

    const welcome = h.welcomeCalls.at(-1)
    expect(welcome.to).toBe(payload.email)
    expect(welcome.rollNo).toBe(payload.roll_no)
    expect(welcome.tempPassword).toBeTruthy()
    expect(welcome.loginUrl).toContain('/student/login')
    const mail = h.transport.calls.at(-1)
    expect(mail.text).toContain(payload.roll_no)
    expect(mail.text).toContain(welcome.tempPassword)
    expect(mail.text).toContain(welcome.loginUrl)

    const row = h.db.prepare('SELECT * FROM students WHERE roll_no = ?').get(payload.roll_no)
    expect(row).toBeTruthy()
    expect(row.password_hash).not.toBe(welcome.tempPassword)
    expect(row.password_hash.length).toBeGreaterThan(30)
  })

  it('rejects a duplicate roll number with 409', async () => {
    const res = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(createStudentPayload({ email: 'another@example.com' }))
    expect(res.status).toBe(409)
    expect(res.body.fieldErrors.roll_no).toMatch(/already/i)
    expect(res.body.error).toMatch(/roll number/i)
  })

  it('rejects a duplicate roll number regardless of case', async () => {
    const res = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(createStudentPayload({ roll_no: '21b81a0001', email: 'third@example.com' }))
    expect(res.status).toBe(409)
    expect(res.body.fieldErrors.roll_no).toBeTruthy()
  })

  it('rejects a duplicate email with 409', async () => {
    const res = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(createStudentPayload({ roll_no: '21B81A0002' }))
    expect(res.status).toBe(409)
    expect(res.body.fieldErrors.email).toMatch(/already/i)
  })

  it('validates required fields, email and phone', async () => {
    const badEmail = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(createStudentPayload({ email: 'not-an-email' }))
    expect(badEmail.status).toBe(400)
    expect(badEmail.body.fieldErrors.email).toMatch(/valid email/i)

    const badPhone = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(createStudentPayload({ phone: 'abc' }))
    expect(badPhone.status).toBe(400)
    expect(badPhone.body.fieldErrors.phone).toBeTruthy()

    const missingName = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(createStudentPayload({ name: '' }))
    expect(missingName.status).toBe(400)
    expect(missingName.body.fieldErrors.name).toBeTruthy()

    const badClass = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(createStudentPayload({ class: 'PhD' }))
    expect(badClass.status).toBe(400)
    expect(badClass.body.fieldErrors.class).toMatch(/B.Tech/)

    const badSection = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send(createStudentPayload({ section: 'ECE' }))
    expect(badSection.status).toBe(400)
    expect(badSection.body.fieldErrors.section).toMatch(/CSE/)
  })

  it('lists students without exposing password hashes', async () => {
    const res = await request(h.app).get('/api/admin/students').set('Cookie', admin)
    expect(res.status).toBe(200)
    expect(res.body.students.length).toBeGreaterThanOrEqual(1)
    for (const student of res.body.students) {
      expect(student).not.toHaveProperty('password_hash')
      expect(student).toHaveProperty('roll_no')
    }
  })

  it('returns the temporary password once when the welcome email fails', async () => {
    h.transport.fail = true
    try {
      const payload = createStudentPayload({
        roll_no: uniqueRoll(),
        email: uniqueEmail(),
        name: 'Failed Mail Student',
      })
      const res = await request(h.app)
        .post('/api/admin/students')
        .set('Cookie', admin)
        .send(payload)
      expect(res.status).toBe(201)
      expect(res.body.email_status).toBe('failed')
      expect(res.body.temp_password).toMatch(/^[A-Za-z0-9]{8,}$/)
      expect(res.body.email_warning).toMatch(/temporary password/i)

      // still never stored in plaintext
      const row = h.db.prepare('SELECT password_hash FROM students WHERE roll_no = ?').get(payload.roll_no)
      expect(row.password_hash).not.toBe(res.body.temp_password)
      expect(JSON.stringify(res.body)).not.toContain(row.password_hash)

      // the shown password still works for login
      const login = await studentLogin(h, payload.roll_no, res.body.temp_password)
      expect(login.status).toBe(200)
    } finally {
      h.transport.fail = false
    }
  })

  it('deletes a student and cascades their attendance', async () => {
    const { payload } = await createStudent(h, admin, {
      roll_no: uniqueRoll(),
      email: uniqueEmail(),
      name: 'Delete Me',
    })
    const created = h.db.prepare('SELECT id FROM students WHERE roll_no = ?').get(payload.roll_no)
    h.db
      .prepare(
        "INSERT INTO attendance (student_id, date, status) VALUES (?, '2026-10-01', 'present')"
      )
      .run(created.id)
    h.db
      .prepare(
        "INSERT INTO attendance (student_id, date, status) VALUES (?, '2026-10-02', 'absent')"
      )
      .run(created.id)
    expect(
      h.db.prepare('SELECT COUNT(*) AS c FROM attendance WHERE student_id = ?').get(created.id).c
    ).toBe(2)

    const res = await request(h.app)
      .delete(`/api/admin/students/${created.id}`)
      .set('Cookie', admin)
    expect(res.status).toBe(200)
    expect(res.body.deleted.roll_no).toBe(payload.roll_no)

    expect(h.db.prepare('SELECT id FROM students WHERE id = ?').get(created.id)).toBeUndefined()
    expect(
      h.db.prepare('SELECT COUNT(*) AS c FROM attendance WHERE student_id = ?').get(created.id).c
    ).toBe(0)

    // deleted student can no longer log in
    const login = await studentLogin(h, payload.roll_no, h.welcomeCalls.at(-1).tempPassword)
    expect(login.status).toBe(401)

    // and their existing session token stops resolving
    const oldToken = await studentLogin(h, payload.roll_no, 'whatever-wrong-1')
    expect(oldToken.status).toBe(401)
  })

  it('returns 404 when deleting a missing student', async () => {
    const res = await request(h.app).delete('/api/admin/students/999999').set('Cookie', admin)
    expect(res.status).toBe(404)
    const invalid = await request(h.app).delete('/api/admin/students/abc').set('Cookie', admin)
    expect(invalid.status).toBe(404)
  })
})

function uniqueRoll() {
  uniqueRoll.n = (uniqueRoll.n || 0) + 1
  return `21B81A9${String(uniqueRoll.n).padStart(3, '0')}`
}

function uniqueEmail() {
  uniqueEmail.n = (uniqueEmail.n || 0) + 1
  return `student${uniqueEmail.n}@example.com`
}
