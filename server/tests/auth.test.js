import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  adminLogin,
  cookieFrom,
  createHarness,
  createStudent,
  studentLogin,
} from './helpers.js'

describe('auth: login, sessions and role protection', () => {
  let h
  beforeAll(() => {
    h = createHarness()
  })
  afterAll(() => h.cleanup())

  it('logs the admin in with env credentials and sets an httpOnly cookie', async () => {
    const res = await request(h.app)
      .post('/api/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ role: 'admin', email: ADMIN_EMAIL })
    expect(res.body.user).not.toHaveProperty('password')
    const cookie = res.headers['set-cookie'][0]
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//i)
    expect(cookie).not.toMatch(/Secure/i) // not secure in tests (non-production)

    const me = await request(h.app).get('/api/auth/me').set('Cookie', cookieFrom(res))
    expect(me.status).toBe(200)
    expect(me.body.user.role).toBe('admin')
  })

  it('rejects a wrong admin password with 401', async () => {
    const res = await request(h.app)
      .post('/api/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: 'not-the-password' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Invalid email or password/i)
  })

  it('rejects an unknown admin email with 401', async () => {
    const res = await request(h.app)
      .post('/api/auth/admin/login')
      .send({ email: 'intruder@example.com', password: ADMIN_PASSWORD })
    expect(res.status).toBe(401)
  })

  it('validates the admin login body with 400', async () => {
    const res = await request(h.app).post('/api/auth/admin/login').send({ email: 'nope' })
    expect(res.status).toBe(400)
    expect(res.body.fieldErrors).toBeTruthy()
  })

  it('logs a student in with roll number and password', async () => {
    const admin = await adminLogin(h)
    const { payload } = await createStudent(h, admin)
    const login = await studentLogin(h, payload.roll_no, h.welcomeCalls.at(-1).tempPassword)
    expect(login.status).toBe(200)
    expect(login.body.user).toMatchObject({
      role: 'student',
      roll_no: payload.roll_no,
      must_change_password: true,
    })
    expect(login.body.user).not.toHaveProperty('password_hash')

    const me = await request(h.app).get('/api/auth/me').set('Cookie', cookieFrom(login))
    expect(me.status).toBe(200)
    expect(me.body.user.roll_no).toBe(payload.roll_no)
  })

  it('rejects a wrong student password with 401', async () => {
    const res = await studentLogin(h, '21B81A0001', 'WrongPass123')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Invalid roll number or password/i)
  })

  it('rejects an unknown roll number with 401', async () => {
    const res = await studentLogin(h, 'NO-SUCH-ROLL', 'Whatever123')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Invalid roll number or password/i)
  })

  it('blocks protected endpoints without a session (401)', async () => {
    const adminRoute = await request(h.app).get('/api/admin/overview')
    expect(adminRoute.status).toBe(401)
    expect(adminRoute.body.error).toBeTruthy()

    const studentRoute = await request(h.app).get('/api/student/overview')
    expect(studentRoute.status).toBe(401)

    const me = await request(h.app).get('/api/auth/me')
    expect(me.status).toBe(401)
  })

  it('enforces role separation between admin and student (403)', async () => {
    const admin = await adminLogin(h)
    const studentRes = await studentLogin(h, '21B81A0001', h.welcomeCalls.at(-1).tempPassword)
    const student = cookieFrom(studentRes)

    const studentOnAdmin = await request(h.app)
      .get('/api/admin/overview')
      .set('Cookie', student)
    expect(studentOnAdmin.status).toBe(403)

    const studentOnAdminPost = await request(h.app)
      .post('/api/admin/students')
      .set('Cookie', student)
      .send({ name: 'X', roll_no: 'X1', phone: '1234567890', email: 'x@example.com', class: 'B.Tech', section: 'CSE' })
    expect(studentOnAdminPost.status).toBe(403)

    const adminOnStudent = await request(h.app)
      .get('/api/student/overview')
      .set('Cookie', admin)
    expect(adminOnStudent.status).toBe(403)
  })

  it('rejects tampered and expired session tokens (401)', async () => {
    const tampered = 'campusledger_session=eyJhbGciOiJIUzI1NiJ9.tampered.signature'
    const tamperedRes = await request(h.app).get('/api/auth/me').set('Cookie', tampered)
    expect(tamperedRes.status).toBe(401)
    expect(tamperedRes.body.error).toMatch(/expired/i)

    const expired = jwt.sign({ role: 'admin' }, h.config.jwtSecret, { expiresIn: '-10 seconds' })
    const expiredRes = await request(h.app)
      .get('/api/admin/overview')
      .set('Cookie', `campusledger_session=${expired}`)
    expect(expiredRes.status).toBe(401)
    expect(expiredRes.body.error).toMatch(/expired/i)
  })

  it('clears the session on logout', async () => {
    const admin = await adminLogin(h)
    const out = await request(h.app).post('/api/auth/logout').set('Cookie', admin)
    expect(out.status).toBe(200)
    expect(out.headers['set-cookie'][0]).toMatch(/campusledger_session=;/i)

    const me = await request(h.app).get('/api/auth/me').set('Cookie', admin)
    // cookie is still sent by the client in this test; a valid token still resolves
    expect([200, 401]).toContain(me.status)

    const cleared = await request(h.app)
      .get('/api/auth/me')
      .set('Cookie', 'campusledger_session=; ')
    expect(cleared.status).toBe(401)
  })

  it('requires authentication for password change', async () => {
    const res = await request(h.app)
      .post('/api/auth/student/change-password')
      .send({ current_password: 'Temp1234', new_password: 'NewPass1234' })
    expect(res.status).toBe(401)
  })

  it('returns JSON 404 for unknown routes and 400 for malformed JSON', async () => {
    const missing = await request(h.app).get('/api/definitely-not-a-route')
    expect(missing.status).toBe(404)
    expect(missing.body.error).toMatch(/Not found/)

    const bad = await request(h.app)
      .post('/api/auth/admin/login')
      .set('Content-Type', 'application/json')
      .send('{ this is not json')
    expect(bad.status).toBe(400)
    expect(bad.body.error).toMatch(/JSON/i)
  })
})
