import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { loadConfig, SERVER_ROOT_DIR } from './config.js'
import { createDatabase } from './db.js'
import { createMailer } from './lib/mailer.js'
import { createAuthMiddleware } from './middleware/auth.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { authRoutes } from './routes/auth.js'
import { adminRoutes } from './routes/admin.js'
import { studentRoutes } from './routes/student.js'

export function createApp({ config, db, mailer } = {}) {
  const activeConfig = config || loadConfig()
  const activeDb = db || createDatabase(activeConfig.databasePath)
  const activeMailer = mailer || createMailer(activeConfig)
  const auth = createAuthMiddleware({ config: activeConfig, db: activeDb })

  const app = express()
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }))
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(auth.authenticate)

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'CampusLedger' })
  })

  app.use('/api/auth', authRoutes({ config: activeConfig, db: activeDb, mailer: activeMailer, auth }))
  app.use('/api/admin', auth.requireAdmin, adminRoutes({ config: activeConfig, db: activeDb, mailer: activeMailer, auth }))
  app.use('/api/student', studentRoutes({ config: activeConfig, db: activeDb, mailer: activeMailer, auth }))

  const clientDist = path.resolve(SERVER_ROOT_DIR, '..', 'client', 'dist')
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }

  app.use(notFound)
  app.use(errorHandler)

  app.locals.config = activeConfig
  app.locals.db = activeDb
  app.locals.mailer = activeMailer
  return app
}
