export function rateLimit({ windowMs = 60000, max = 10, keyPrefix = 'rl' } = {}) {
  const hits = new Map()

  return function limiter(req, res, next) {
    const now = Date.now()
    if (hits.size > 5000) {
      for (const [key, entry] of hits) {
        if (now - entry.start > windowMs) hits.delete(key)
      }
    }
    const key = `${keyPrefix}:${req.ip || 'unknown'}`
    let entry = hits.get(key)
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 }
      hits.set(key, entry)
    }
    entry.count += 1
    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a moment and try again.' })
    }
    return next()
  }
}
