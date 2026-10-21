import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { adminLogin, createHarness, createStudentPayload } from './helpers.js'
import { formatDateHuman } from '../src/lib/datetime.js'

async function seedStudent(h, admin, overrides = {}) {
  const payload = createStudentPayload(overrides)
  const res = await request(h.app).post('/api/admin/students').set('Cookie', admin).send(payload)
  if (res.status !== 201) throw new Error(`seed failed: ${JSON.stringify(res.body)}`)
  const row = h.db.prepare('SELECT id FROM students WHERE roll_no = ?').get(payload.roll_no)
  return { ...payload, id: row.id }
}

describe('attendance: roster, saving, updating and emails', () => {
  let h
  let admin
  beforeAll(async () => {
    h = createHarness()
    admin = await adminLogin(h)
  })
  afterAll(() => h.cleanup())

  const DATE = '2026-10-21'

  it('filters the roster by class and section and defaults to not marked', async () => {
    await seedStudent(h, admin, { roll_no: 'CSE001', email: 'cse001@example.com' })
    await seedStudent(h, admin, { roll_no: 'CSE002', email: 'cse002@example.com', name: 'Second Student' })
    await seedStudent(h, admin, {
      roll_no: 'AIML001',
      email: 'aiml001@example.com',
      class: 'B.Tech',
      section: 'AIML',
    })
    await seedStudent(h, admin, {
      roll_no: 'MT001',
      email: 'mt001@example.com',
      class: 'M.Tech',
      section: 'CSE',
    })

    const res = await request(h.app)
      .get(`/api/admin/attendance?class=B.Tech&section=CSE&date=${DATE}`)
      .set('Cookie', admin)
    expect(res.status).toBe(200)
    expect(res.body.students).toHaveLength(2)
    expect(res.body.students.map((s) => s.roll_no).sort()).toEqual(['CSE001', 'CSE002'])
    expect(res.body.students.every((s) => s.status === null)).toBe(true)
    expect(res.body.counts).toEqual({ total: 2, present: 0, absent: 0, unmarked: 2 })
  })

  it('rejects invalid attendance query parameters', async () => {
    const badDate = await request(h.app)
      .get('/api/admin/attendance?class=B.Tech&section=CSE&date=21-10-2026')
      .set('Cookie', admin)
    expect(badDate.status).toBe(400)

    const badClass = await request(h.app)
      .get(`/api/admin/attendance?class=PhD&section=CSE&date=${DATE}`)
      .set('Cookie', admin)
    expect(badClass.status).toBe(400)
  })

  it('saves attendance and emails every student in the roster with correct statuses', async () => {
    const rosterRes = await request(h.app)
      .get(`/api/admin/attendance?class=B.Tech&section=CSE&date=${DATE}`)
      .set('Cookie', admin)
    const students = rosterRes.body.students
    const records = [
      { student_id: students[0].id, status: 'present' },
      { student_id: students[1].id, status: 'absent' },
    ]

    const before = h.attendanceCalls.length
    const res = await request(h.app)
      .put('/api/admin/attendance')
      .set('Cookie', admin)
      .send({ class: 'B.Tech', section: 'CSE', date: DATE, records })
    expect(res.status).toBe(200)
    expect(res.body.saved).toBe(2)
    expect(res.body.roster_total).toBe(2)
    expect(res.body.emails).toEqual({ sent: 2, failed: 0 })

    // one email per student in the roster, with the right status
    const sent = h.attendanceCalls.slice(before)
    expect(sent).toHaveLength(2)
    const byRoll = Object.fromEntries(sent.map((mail) => [mail.rollNo, mail]))
    expect(byRoll.CSE001.status).toBe('present')
    expect(byRoll.CSE002.status).toBe('absent')
    expect(byRoll.CSE001.date).toBe(DATE)
    expect(byRoll.CSE001.className).toBe('B.Tech')
    expect(byRoll.CSE001.section).toBe('CSE')

    // subject format: "Attendance Update - B.Tech CSE - 21 Oct 2026"
    const cse001Mail = h.transport.calls
      .filter((mail) => mail.subject.startsWith('Attendance Update'))
      .find((mail) => mail.text.includes('CSE001'))
    expect(cse001Mail.subject).toBe(`Attendance Update - B.Tech CSE - ${formatDateHuman(DATE)}`)
    expect(cse001Mail.text).toContain('CSE001')
    expect(cse001Mail.text).toMatch(/Status: Present/)
  })

  it('returns saved statuses and counts for an already-marked date', async () => {
    const res = await request(h.app)
      .get(`/api/admin/attendance?class=B.Tech&section=CSE&date=${DATE}`)
      .set('Cookie', admin)
    expect(res.status).toBe(200)
    const statuses = Object.fromEntries(res.body.students.map((s) => [s.roll_no, s.status]))
    expect(statuses).toEqual({ CSE001: 'present', CSE002: 'absent' })
    expect(res.body.counts).toEqual({ total: 2, present: 1, absent: 1, unmarked: 0 })
  })

  it('updates an already-saved date without creating duplicate rows', async () => {
    const countBefore = h.db
      .prepare('SELECT COUNT(*) AS c FROM attendance WHERE date = ?')
      .get(DATE).c

    const rosterRes = await request(h.app)
      .get(`/api/admin/attendance?class=B.Tech&section=CSE&date=${DATE}`)
      .set('Cookie', admin)
    const students = rosterRes.body.students
    const records = students.map((s) => ({ student_id: s.id, status: 'absent' }))

    const before = h.attendanceCalls.length
    const res = await request(h.app)
      .put('/api/admin/attendance')
      .set('Cookie', admin)
      .send({ class: 'B.Tech', section: 'CSE', date: DATE, records })
    expect(res.status).toBe(200)
    expect(res.body.saved).toBe(2)
    expect(res.body.emails.sent).toBe(2) // resends on update
    expect(h.attendanceCalls.length - before).toBe(2)

    const countAfter = h.db.prepare('SELECT COUNT(*) AS c FROM attendance WHERE date = ?').get(DATE).c
    expect(countAfter).toBe(countBefore)

    const check = await request(h.app)
      .get(`/api/admin/attendance?class=B.Tech&section=CSE&date=${DATE}`)
      .set('Cookie', admin)
    expect(check.body.students.every((s) => s.status === 'absent')).toBe(true)
    expect(check.body.counts).toEqual({ total: 2, present: 0, absent: 2, unmarked: 0 })
  })

  it('updates the admin overview counts for today', async () => {
    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const rosterRes = await request(h.app)
      .get(`/api/admin/attendance?class=B.Tech&section=CSE&date=${date}`)
      .set('Cookie', admin)
    const students = rosterRes.body.students
    await request(h.app)
      .put('/api/admin/attendance')
      .set('Cookie', admin)
      .send({
        class: 'B.Tech',
        section: 'CSE',
        date,
        records: [
          { student_id: students[0].id, status: 'present' },
          { student_id: students[1].id, status: 'present' },
        ],
      })

    const overview = await request(h.app).get('/api/admin/overview').set('Cookie', admin)
    expect(overview.status).toBe(200)
    expect(overview.body.present_today).toBe(2)
    expect(overview.body.absent_today).toBe(0)
    expect(overview.body.total_students).toBe(4)
    expect(overview.body.assignments).toBe(0)
  })

  it('succeeds even when every attendance email fails', async () => {
    h.transport.fail = true
    try {
      const today = new Date()
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const rosterRes = await request(h.app)
        .get(`/api/admin/attendance?class=M.Tech&section=CSE&date=${date}`)
        .set('Cookie', admin)
      const students = rosterRes.body.students
      const res = await request(h.app)
        .put('/api/admin/attendance')
        .set('Cookie', admin)
        .send({
          class: 'M.Tech',
          section: 'CSE',
          date,
          records: students.map((s) => ({ student_id: s.id, status: 'absent' })),
        })
      expect(res.status).toBe(200)
      expect(res.body.saved).toBe(students.length)
      expect(res.body.emails).toEqual({ sent: 0, failed: students.length })

      // the save itself persisted
      const check = await request(h.app)
        .get(`/api/admin/attendance?class=M.Tech&section=CSE&date=${date}`)
        .set('Cookie', admin)
      expect(check.body.students.every((s) => s.status === 'absent')).toBe(true)
    } finally {
      h.transport.fail = false
    }
  })

  it('rejects records from students outside the selected class and section', async () => {
    const cseRoster = await request(h.app)
      .get(`/api/admin/attendance?class=B.Tech&section=CSE&date=2026-11-01`)
      .set('Cookie', admin)
    const aiml = h.db.prepare("SELECT id FROM students WHERE roll_no = 'AIML001'").get()
    const res = await request(h.app)
      .put('/api/admin/attendance')
      .set('Cookie', admin)
      .send({
        class: 'B.Tech',
        section: 'CSE',
        date: '2026-11-01',
        records: [{ student_id: aiml.id, status: 'present' }],
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/do not belong/i)
    expect(cseRoster.status).toBe(200)
  })

  it('rejects saving to an empty roster and invalid payloads', async () => {
    const empty = await request(h.app)
      .put('/api/admin/attendance')
      .set('Cookie', admin)
      .send({
        class: 'M.Tech',
        section: 'Civil',
        date: '2026-11-02',
        records: [{ student_id: 1, status: 'present' }],
      })
    expect(empty.status).toBe(400)
    expect(empty.body.error).toMatch(/No students/i)

    const badStatus = await request(h.app)
      .put('/api/admin/attendance')
      .set('Cookie', admin)
      .send({
        class: 'B.Tech',
        section: 'CSE',
        date: '2026-11-02',
        records: [{ student_id: 1, status: 'late' }],
      })
    expect(badStatus.status).toBe(400)

    const noRecords = await request(h.app)
      .put('/api/admin/attendance')
      .set('Cookie', admin)
      .send({ class: 'B.Tech', section: 'CSE', date: '2026-11-02', records: [] })
    expect(noRecords.status).toBe(400)
  })
})
