import { Router } from 'express'
import { asyncHandler, sendError } from '../lib/errors.js'
import {
  adminLoginSchema,
  changePasswordSchema,
  firstFieldErrors,
  studentLoginSchema,
} from '../lib/validation.js'
import { COOKIE_NAME, sessionCookieOptions, signSession } from '../lib/tokens.js'
import { DUMMY_HASH, hashPassword, timingSafeEqualStrings, verifyPassword } from '../lib/password.js'
import { publicStudent, studentColumns } from '../lib/serialize.js'
import { rateLimit } from '../middleware/rateLimit.js'

export function authRoutes({ config, db, auth }) {
  const router = Router()
  const loginLimit = rateLimit({ max: config.isProd ? 10 : 200, keyPrefix: 'login' })

  router.post('/admin/login', loginLimit, asyncHandler(async (req, res) => {
    const parsed = adminLoginSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: firstFieldErrors(parsed.error) })
    }
    const emailOk = timingSafeEqualStrings(parsed.data.email.toLowerCase(), config.adminEmail)
    const passwordOk = timingSafeEqualStrings(parsed.data.password, config.adminPassword)
    if (!emailOk || !passwordOk) {
      return sendError(res, 401, 'Invalid email or password.')
    }
    const token = signSession({ role: 'admin' }, config)
    res.cookie(COOKIE_NAME, token, sessionCookieOptions(config))
    return res.json({ user: { role: 'admin', name: 'Administrator', email: config.adminEmail } })
  }))

  router.post('/student/login', loginLimit, asyncHandler(async (req, res) => {
    const parsed = studentLoginSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: firstFieldErrors(parsed.error) })
    }
    const rollNo = parsed.data.roll_no.toUpperCase()
    const student = db.prepare('SELECT * FROM students WHERE roll_no = ?').get(rollNo)
    if (!student) {
      await verifyPassword(parsed.data.password, DUMMY_HASH)
      return sendError(res, 401, 'Invalid roll number or password.')
    }
    const ok = await verifyPassword(parsed.data.password, student.password_hash)
    if (!ok) {
      return sendError(res, 401, 'Invalid roll number or password.')
    }
    const token = signSession({ role: 'student', sub: student.id }, config)
    res.cookie(COOKIE_NAME, token, sessionCookieOptions(config))
    return res.json({ user: { role: 'student', ...publicStudent(student) } })
  }))

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' })
    return res.json({ message: 'Signed out.' })
  })

  router.get('/me', (req, res) => {
    if (!req.user) {
      return sendError(
        res,
        401,
        req.authFailure === 'expired' ? 'Your session has expired. Please sign in again.' : 'Not signed in.'
      )
    }
    if (req.user.type === 'admin') {
      return res.json({ user: { role: 'admin', name: 'Administrator', email: config.adminEmail } })
    }
    return res.json({ user: { role: 'student', ...publicStudent(req.user.student) } })
  })

  router.post('/student/change-password', auth.requireStudent({ allowPasswordChange: true }), asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: firstFieldErrors(parsed.error) })
    }
    const { current_password, new_password } = parsed.data

    const row = db.prepare('SELECT id, password_hash FROM students WHERE id = ?').get(req.user.id)
    if (!row) {
      return sendError(res, 401, 'Your session has expired. Please sign in again.')
    }
    const ok = await verifyPassword(current_password, row.password_hash)
    if (!ok) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: { current_password: 'Current password is incorrect.' } })
    }
    if (current_password === new_password) {
      return sendError(res, 400, 'Validation failed.', {
        fieldErrors: { new_password: 'New password must be different from the current password.' },
      })
    }

    const passwordHash = await hashPassword(new_password)
    db.prepare('UPDATE students SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
      passwordHash,
      row.id
    )
    const student = db.prepare(`SELECT ${studentColumns} FROM students WHERE id = ?`).get(row.id)
    const token = signSession({ role: 'student', sub: row.id }, config)
    res.cookie(COOKIE_NAME, token, sessionCookieOptions(config))
    return res.json({ user: { role: 'student', ...publicStudent(student) }, message: 'Password updated.' })
  }))

  return router
}
