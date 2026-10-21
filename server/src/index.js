import { createApp } from './app.js'

const app = createApp()
const { config, db, mailer } = app.locals

for (const warning of config.warnings) {
  console.warn(`[CampusLedger] ${warning}`)
}
console.log(
  `[CampusLedger] mail transport: ${mailer.mode}` +
    (mailer.mode === 'smtp'
      ? ` (${config.smtp.host}:${config.smtp.port})`
      : ' (emails are printed to the server console, not delivered)')
)

const server = app.listen(config.port, () => {
  console.log(`[CampusLedger] API listening on http://localhost:${config.port}`)
  console.log(`[CampusLedger] web app expected at ${config.appUrl}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[CampusLedger] Port ${config.port} is already in use. Change PORT in server/.env.`)
    process.exit(1)
  }
  console.error('[CampusLedger] Server error:', err)
  process.exit(1)
})

function shutdown() {
  server.close(() => {
    try {
      db.close()
    } catch {
      /* ignore */
    }
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 3000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
