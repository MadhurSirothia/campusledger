import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

dotenv.config({ path: path.join(SERVER_ROOT, '.env') })

const DEV_ADMIN_EMAIL = 'admin@campusledger.edu'
const DEV_ADMIN_PASSWORD = 'Admin@Campus123'
const DEV_JWT_SECRET = 'campusledger-dev-secret-change-me-in-production'

export const SERVER_ROOT_DIR = SERVER_ROOT

export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides }
  const isProd = String(env.NODE_ENV || '').toLowerCase() === 'production'
  const warnings = []

  const jwtSecret = String(env.JWT_SECRET || '').trim()
  if (!jwtSecret) {
    if (isProd) throw new Error('JWT_SECRET is required when NODE_ENV=production.')
    warnings.push('JWT_SECRET is not set - using an insecure development secret.')
  }

  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase()
  const adminPassword = String(env.ADMIN_PASSWORD || '').trim()
  if (!adminEmail || !adminPassword) {
    if (isProd) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required when NODE_ENV=production.')
    warnings.push(`ADMIN_EMAIL/ADMIN_PASSWORD not set - using the demo admin (${DEV_ADMIN_EMAIL}).`)
  }

  const smtpUser = String(env.SMTP_USER || '').trim()
  const smtpPass = String(env.SMTP_PASS || '')
  const smtpPort = Number(env.SMTP_PORT || 587)

  let mailTransport = String(env.MAIL_TRANSPORT || '').trim().toLowerCase()
  if (mailTransport !== 'smtp' && mailTransport !== 'dev') {
    mailTransport = smtpUser && smtpPass ? 'smtp' : 'dev'
  }

  return {
    isProd,
    warnings,
    port: Number(env.PORT || 4000),
    appUrl: String(env.APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),
    jwtSecret: jwtSecret || DEV_JWT_SECRET,
    adminEmail: adminEmail || DEV_ADMIN_EMAIL,
    adminPassword: adminPassword || DEV_ADMIN_PASSWORD,
    databasePath: String(env.DATABASE_PATH || path.join(SERVER_ROOT, 'data', 'campusledger.sqlite')),
    uploadsDir: String(env.UPLOADS_DIR || path.join(SERVER_ROOT, 'uploads', 'assignments')),
    mailTransport,
    mailFrom: String(env.MAIL_FROM || '').trim() || `CampusLedger <${smtpUser || 'campusledger@gmail.com'}>`,
    smtp: {
      host: String(env.SMTP_HOST || 'smtp.gmail.com').trim(),
      port: smtpPort,
      secure: smtpPort === 465,
      user: smtpUser,
      pass: smtpPass,
    },
    maxAssignmentBytes: 10 * 1024 * 1024,
    jwtExpiresIn: '7d',
  }
}
