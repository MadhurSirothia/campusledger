import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

export const BCRYPT_ROUNDS = 10

// Used to equalize login timing when the roll number does not exist.
export const DUMMY_HASH = bcrypt.hashSync('campusledger-timing-equalizer', 4)

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function generateTempPassword(length = 14) {
  let candidate = ''
  do {
    candidate = ''
    for (let i = 0; i < length; i += 1) {
      candidate += ALPHABET[crypto.randomInt(ALPHABET.length)]
    }
  } while (!isStrongPassword(candidate))
  return candidate
}

export function timingSafeEqualStrings(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a ?? ''), 'utf8').digest()
  const hashB = crypto.createHash('sha256').update(String(b ?? ''), 'utf8').digest()
  return crypto.timingSafeEqual(hashA, hashB)
}
