import { COOKIE_NAME, clearCookieOptions, verifySession } from '../lib/tokens.js'

const STUDENT_COLUMNS = 'id, name, roll_no, phone, email, class, section, must_change_password, created_at'

export function createAuthMiddleware({ config, db }) {
  function authenticate(req, res, next) {
    req.user = null
    req.authFailure = null
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) return next()

    let payload
    try {
      payload = verifySession(token, config)
    } catch (err) {
      req.authFailure = 'expired'
      res.clearCookie(COOKIE_NAME, clearCookieOptions(config))
      return next()
    }

    if (payload.role === 'admin') {
      req.user = { type: 'admin', id: 0 }
      return next()
    }

    if (payload.role === 'student' && Number.isInteger(payload.sub) && payload.sub > 0) {
      const student = db
        .prepare(`SELECT ${STUDENT_COLUMNS} FROM students WHERE id = ?`)
        .get(payload.sub)
      if (!student) {
        req.authFailure = 'expired'
        res.clearCookie(COOKIE_NAME, clearCookieOptions(config))
        return next()
      }
      req.user = {
        type: 'student',
        id: student.id,
        student,
        mustChangePassword: Boolean(student.must_change_password),
      }
      return next()
    }

    req.authFailure = 'expired'
    res.clearCookie(COOKIE_NAME, clearCookieOptions(config))
    return next()
  }

  function requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: req.authFailure === 'expired' ? 'Your session has expired. Please sign in again.' : 'Sign in as an administrator to continue.',
      })
    }
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required.' })
    }
    return next()
  }

  function requireStudent({ allowPasswordChange = false } = {}) {
    return function guard(req, res, next) {
      if (!req.user) {
        return res.status(401).json({
          error: req.authFailure === 'expired' ? 'Your session has expired. Please sign in again.' : 'Sign in as a student to continue.',
        })
      }
      if (req.user.type !== 'student') {
        return res.status(403).json({ error: 'Student access required.' })
      }
      if (req.user.mustChangePassword && !allowPasswordChange) {
        return res.status(403).json({
          error: 'Please change your password to continue.',
          code: 'PASSWORD_CHANGE_REQUIRED',
        })
      }
      return next()
    }
  }

  return { authenticate, requireAdmin, requireStudent }
}
