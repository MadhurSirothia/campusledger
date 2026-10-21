import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { createDatabase } from '../src/db.js'
import { createMailer } from '../src/lib/mailer.js'

export const ADMIN_EMAIL = 'admin@campusledger.edu'
export const ADMIN_PASSWORD = 'Admin@Campus123'

let uniqueCounter = 0
export function unique(value) {
  uniqueCounter += 1
  return `${value}${uniqueCounter}`
}

function createFakeTransport() {
  return {
    calls: [],
    fail: false,
    async sendMail(mail) {
      if (this.fail) {
        const err = new Error('SMTP connection refused (test transport)')
        err.code = 'ECONNECTION'
        throw err
      }
      this.calls.push(mail)
      return { messageId: `test-${this.calls.length}` }
    },
  }
}

export function createHarness() {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campusledger-uploads-'))
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    JWT_SECRET: 'test-secret-campusledger-8e1f4a2b',
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    DATABASE_PATH: ':memory:',
    UPLOADS_DIR: uploadsDir,
    MAIL_TRANSPORT: 'dev',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_PORT: '587',
  })
  const db = createDatabase(':memory:')
  const transport = createFakeTransport()
  const mailer = createMailer(config, { transport })

  const welcomeCalls = []
  const attendanceCalls = []
  const originalWelcome = mailer.sendWelcomeEmail.bind(mailer)
  const originalAttendance = mailer.sendAttendanceEmail.bind(mailer)
  mailer.sendWelcomeEmail = async (params) => {
    welcomeCalls.push(params)
    return originalWelcome(params)
  }
  mailer.sendAttendanceEmail = async (params) => {
    attendanceCalls.push(params)
    return originalAttendance(params)
  }

  const app = createApp({ config, db, mailer })

  return {
    app,
    db,
    config,
    mailer,
    transport,
    uploadsDir,
    welcomeCalls,
    attendanceCalls,
    cleanup() {
      try {
        db.close()
      } catch {
        /* ignore */
      }
      fs.rmSync(uploadsDir, { recursive: true, force: true })
    },
  }
}

export function cookieFrom(res) {
  const raw = res.headers['set-cookie']
  if (!raw || !raw.length) throw new Error('Expected a Set-Cookie header')
  return raw.map((entry) => entry.split(';')[0]).join('; ')
}

export async function adminLogin(harness) {
  const res = await request(harness.app)
    .post('/api/auth/admin/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  if (res.status !== 200) {
    throw new Error(`Admin login failed (${res.status}): ${JSON.stringify(res.body)}`)
  }
  return cookieFrom(res)
}

export async function studentLogin(harness, rollNo, password) {
  return request(harness.app)
    .post('/api/auth/student/login')
    .send({ roll_no: rollNo, password })
}

export function studentCookie(res) {
  if (res.status !== 200) {
    throw new Error(`Student login failed (${res.status}): ${JSON.stringify(res.body)}`)
  }
  return cookieFrom(res)
}

export function createStudentPayload(overrides = {}) {
  return {
    name: 'Asha Verma',
    roll_no: '21B81A0001',
    phone: '9876543210',
    email: 'asha.verma@example.com',
    class: 'B.Tech',
    section: 'CSE',
    ...overrides,
  }
}

export async function createStudent(harness, cookie, overrides = {}) {
  const payload = createStudentPayload(overrides)
  const res = await request(harness.app)
    .post('/api/admin/students')
    .set('Cookie', cookie)
    .send(payload)
  if (res.status !== 201) {
    throw new Error(`Student creation failed (${res.status}): ${JSON.stringify(res.body)}`)
  }
  return { res, payload }
}

export function fakePngBuffer(size = 128) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const body = Buffer.alloc(Math.max(0, size - header.length), 0x42)
  return Buffer.concat([header, body])
}

export function binaryParser(res, callback) {
  const chunks = []
  res.on('data', (chunk) => chunks.push(chunk))
  res.on('end', () => callback(null, Buffer.concat(chunks)))
}
