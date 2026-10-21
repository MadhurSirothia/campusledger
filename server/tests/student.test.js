import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { adminLogin, cookieFrom, createHarness, createStudent, studentLogin } from './helpers.js'

const TODAY = (() => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})()

describe('student: forced password change, personal attendance and isolation', () => {
  let h
  let admin
  let tempPassword
  let rollNo
  let studentId
  let firstCookie

  beforeAll(async () => {
    h = createHarness()
    admin = await adminLogin(h)
    const { payload } = await createStudent(h, admin, {
      roll_no: 'ISO001',
      email: 'iso001@example.com',
      name: 'First Student',
    })
    rollNo = payload.roll_no
    tempPassword = h.welcomeCalls.at(-1).tempPassword
    studentId = h.db.prepare('SELECT id FROM students WHERE roll_no = ?').get(rollNo).id
    const login = await studentLogin(h, rollNo, tempPassword)
    firstCookie = cookieFrom(login)
  })
  afterAll(() => h.cleanup())

  it('flags a new student for a forced password change', async () => {
    const login = await studentLogin(h, rollNo, tempPassword)
    expect(login.status).toBe(200)
    expect(login.body.user.must_change_password).toBe(true)
    expect(login.body.user).not.toHaveProperty('password_hash')
  })

  it('blocks student endpoints until the password is changed', async () => {
    const overview = await request(h.app)
      .get('/api/student/overview')
      .set('Cookie', firstCookie)
    expect(overview.status).toBe(403)
    expect(overview.body.code).toBe('PASSWORD_CHANGE_REQUIRED')

    const attendance = await request(h.app)
      .get('/api/student/attendance')
      .set('Cookie', firstCookie)
    expect(attendance.status).toBe(403)

    const assignments = await request(h.app)
      .get('/api/student/assignments')
      .set('Cookie', firstCookie)
    expect(assignments.status).toBe(403)

    // /me still works so the client can show the change-password screen
    const me = await request(h.app).get('/api/auth/me').set('Cookie', firstCookie)
    expect(me.status).toBe(200)
    expect(me.body.user.must_change_password).toBe(true)
  })

  it('validates the change-password form', async () => {
    const wrongCurrent = await request(h.app)
      .post('/api/auth/student/change-password')
      .set('Cookie', firstCookie)
      .send({ current_password: 'TotallyWrong1', new_password: 'BrandNew1234' })
    expect(wrongCurrent.status).toBe(400)
    expect(wrongCurrent.body.fieldErrors.current_password).toMatch(/incorrect/i)

    const weakNew = await request(h.app)
      .post('/api/auth/student/change-password')
      .set('Cookie', firstCookie)
      .send({ current_password: tempPassword, new_password: 'short' })
    expect(weakNew.status).toBe(400)
    expect(weakNew.body.fieldErrors.new_password).toBeTruthy()

    const noDigits = await request(h.app)
      .post('/api/auth/student/change-password')
      .set('Cookie', firstCookie)
      .send({ current_password: tempPassword, new_password: 'onlyletters' })
    expect(noDigits.status).toBe(400)

    const sameAsCurrent = await request(h.app)
      .post('/api/auth/student/change-password')
      .set('Cookie', firstCookie)
      .send({ current_password: tempPassword, new_password: tempPassword })
    expect(sameAsCurrent.status).toBe(400)
    expect(sameAsCurrent.body.fieldErrors.new_password).toMatch(/different/i)
  })

  it('changes the password and lifts the access block', async () => {
    const res = await request(h.app)
      .post('/api/auth/student/change-password')
      .set('Cookie', firstCookie)
      .send({ current_password: tempPassword, new_password: 'Campus2026Pass' })
    expect(res.status).toBe(200)
    expect(res.body.user.must_change_password).toBe(false)

    const overview = await request(h.app)
      .get('/api/student/overview')
      .set('Cookie', firstCookie)
    expect(overview.status).toBe(200)
    expect(overview.body.student.roll_no).toBe(rollNo)
  })

  it('rejects the old temporary password and accepts the new one', async () => {
    const oldLogin = await studentLogin(h, rollNo, tempPassword)
    expect(oldLogin.status).toBe(401)

    const newLogin = await studentLogin(h, rollNo, 'Campus2026Pass')
    expect(newLogin.status).toBe(200)
    expect(newLogin.body.user.must_change_password).toBe(false)
  })

  it('calculates today and total attendance correctly', async () => {
    const insert = h.db.prepare(
      "INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)"
    )
    // 3 present, 2 absent on past days + present today
    insert.run(studentId, '2026-10-16', 'present')
    insert.run(studentId, '2026-10-17', 'absent')
    insert.run(studentId, '2026-10-18', 'present')
    insert.run(studentId, '2026-10-19', 'present')
    insert.run(studentId, '2026-10-20', 'absent')
    insert.run(studentId, TODAY, 'present')

    const overview = await request(h.app)
      .get('/api/student/overview')
      .set('Cookie', firstCookie)
    expect(overview.status).toBe(200)
    expect(overview.body.attendance.today_status).toBe('present')
    expect(overview.body.attendance.date).toBe(TODAY)
    expect(overview.body.attendance.marked_days).toBe(6)
    expect(overview.body.attendance.present_days).toBe(4)
    expect(overview.body.attendance.percentage).toBeCloseTo(66.7, 1)

    const detailed = await request(h.app)
      .get('/api/student/attendance')
      .set('Cookie', firstCookie)
    expect(detailed.status).toBe(200)
    expect(detailed.body.today).toEqual({ date: TODAY, status: 'present' })
    expect(detailed.body.totals).toEqual({ present_days: 4, marked_days: 6, percentage: 66.7 })
    expect(detailed.body.records.length).toBe(6)
    // newest first
    const dates = detailed.body.records.map((r) => r.date)
    expect(dates[0]).toBe(TODAY)
    expect([...dates].sort().reverse()).toEqual(dates)
    const statuses = Object.fromEntries(detailed.body.records.map((r) => [r.date, r.status]))
    expect(statuses['2026-10-17']).toBe('absent')
    expect(statuses['2026-10-19']).toBe('present')
  })

  it("never exposes another student's records", async () => {
    const second = await createStudent(h, admin, {
      roll_no: 'ISO002',
      email: 'iso002@example.com',
      name: 'Second Student',
      section: 'AIML',
    })
    const secondId = h.db.prepare("SELECT id FROM students WHERE roll_no = 'ISO002'").get().id
    const secondTemp = h.welcomeCalls.at(-1).tempPassword
    h.db
      .prepare("INSERT INTO attendance (student_id, date, status) VALUES (?, '2026-10-15', 'absent')")
      .run(secondId)
    h.db
      .prepare("INSERT INTO attendance (student_id, date, status) VALUES (?, '2026-10-16', 'present')")
      .run(secondId)

    const secondLogin = await studentLogin(h, second.payload.roll_no, secondTemp)
    const secondCookie = cookieFrom(secondLogin)
    const secondChange = await request(h.app)
      .post('/api/auth/student/change-password')
      .set('Cookie', secondCookie)
      .send({ current_password: secondTemp, new_password: 'SecondPass2026' })
    expect(secondChange.status).toBe(200)

    const mine = await request(h.app)
      .get('/api/student/attendance')
      .set('Cookie', firstCookie)
    expect(mine.body.student.roll_no).toBe('ISO001')
    expect(mine.body.records.every((r) => r.date !== '2026-10-15')).toBe(true)
    expect(mine.body.totals.marked_days).toBe(6) // untouched by the second student's rows

    const theirs = await request(h.app)
      .get('/api/student/attendance')
      .set('Cookie', secondCookie)
    expect(theirs.body.student.roll_no).toBe('ISO002')
    expect(theirs.body.totals.marked_days).toBe(2)
    expect(theirs.body.records.map((r) => r.date).sort()).toEqual(['2026-10-15', '2026-10-16'])
    expect(theirs.body.records.every((r) => r.date !== '2026-10-17')).toBe(true)

    const theirOverview = await request(h.app)
      .get('/api/student/overview')
      .set('Cookie', secondCookie)
    expect(theirOverview.body.student.email).toBe('iso002@example.com')
    expect(theirOverview.body.student.id).not.toBe(studentId)
  })

  it('reports not-marked today for a student without attendance', async () => {
    const fresh = await createStudent(h, admin, {
      roll_no: 'NOMARK01',
      email: 'nomark01@example.com',
      name: 'No Marks Student',
      section: 'IT',
    })
    const temp = h.welcomeCalls.at(-1).tempPassword
    const login = await studentLogin(h, fresh.payload.roll_no, temp)
    const cookie = cookieFrom(login)
    await request(h.app)
      .post('/api/auth/student/change-password')
      .set('Cookie', cookie)
      .send({ current_password: temp, new_password: 'ChangedPass123' })

    const overview = await request(h.app)
      .get('/api/student/overview')
      .set('Cookie', cookie)
    expect(overview.status).toBe(200)
    expect(overview.body.attendance.today_status).toBeNull()
    expect(overview.body.attendance.marked_days).toBe(0)
    expect(overview.body.attendance.percentage).toBe(0)
    expect(overview.body.assignments_count).toBe(0)

    const detailed = await request(h.app)
      .get('/api/student/attendance')
      .set('Cookie', cookie)
    expect(detailed.body.today.status).toBeNull()
    expect(detailed.body.records).toHaveLength(0)
  })
})
