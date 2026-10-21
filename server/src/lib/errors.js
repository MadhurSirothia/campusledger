export function sendError(res, status, error, extra = {}) {
  return res.status(status).json({ error, ...extra })
}

export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}
