import jwt from 'jsonwebtoken'

export const COOKIE_NAME = 'campusledger_session'

export function signSession(payload, config) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn || '7d' })
}

export function verifySession(token, config) {
  return jwt.verify(token, config.jwtSecret)
}

export function sessionCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
}

export function clearCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
  }
}
