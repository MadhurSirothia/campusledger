import { Router } from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { asyncHandler, sendError } from '../lib/errors.js'
import {
  attendanceQuerySchema,
  attendanceSaveSchema,
  assignmentMetaSchema,
  createStudentSchema,
  firstFieldErrors,
} from '../lib/validation.js'
import { generateTempPassword, hashPassword } from '../lib/password.js'
import { publicAssignment, publicStudent, studentColumns } from '../lib/serialize.js'
import { sendFileDownload, validateAssignmentFile } from '../lib/files.js'
import { formatDateHuman, todayISO } from '../lib/datetime.js'

export function adminRoutes({ config, db, mailer }) {
  const router = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxAssignmentBytes, files: 1 },
  })

  router.get('/overview', (req, res) => {
    const date = todayISO()
    const totalStudents = db.prepare('SELECT COUNT(*) AS count FROM students').get().count
    const presentToday = db
      .prepare("SELECT COUNT(*) AS count FROM attendance WHERE date = ? AND status = 'present'")
      .get(date).count
    const absentToday = db
      .prepare("SELECT COUNT(*) AS count FROM attendance WHERE date = ? AND status = 'absent'")
      .get(date).count
    const assignmentCount = db.prepare('SELECT COUNT(*) AS count FROM assignments').get().count
    res.json({
      total_students: totalStudents,
      present_today: presentToday,
      absent_today: absentToday,
      assignments: assignmentCount,
      date,
    })
  })

  router.get('/students', (req, res) => {
    const rows = db
      .prepare(`SELECT ${studentColumns} FROM students ORDER BY class, section, roll_no`)
      .all()
    res.json({ students: rows.map(publicStudent) })
  })

  router.post('/students', asyncHandler(async (req, res) => {
    const parsed = createStudentSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: firstFieldErrors(parsed.error) })
    }
    const data = parsed.data
    const email = data.email.toLowerCase()
    const rollNo = data.roll_no.toUpperCase()

    const duplicateRoll = db.prepare('SELECT id FROM students WHERE roll_no = ?').get(rollNo)
    if (duplicateRoll) {
      return sendError(res, 409, 'A student with this roll number already exists.', {
        fieldErrors: { roll_no: 'This roll number is already registered.' },
      })
    }
    const duplicateEmail = db.prepare('SELECT id FROM students WHERE email = ?').get(email)
    if (duplicateEmail) {
      return sendError(res, 409, 'A student with this email address already exists.', {
        fieldErrors: { email: 'This email address is already registered.' },
      })
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)

    let newId
    try {
      const info = db
        .prepare(
          `INSERT INTO students (name, roll_no, phone, email, class, section, password_hash, must_change_password)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .run(data.name, rollNo, data.phone, email, data.class, data.section, passwordHash)
      newId = info.lastInsertRowid
    } catch (err) {
      if (String(err?.message || '').toUpperCase().includes('UNIQUE')) {
        return sendError(res, 409, 'A student with this roll number or email already exists.', {
          fieldErrors: { roll_no: 'This roll number is already registered.' },
        })
      }
      throw err
    }

    const loginUrl = `${config.appUrl}/student/login`
    let emailStatus = 'sent'
    let emailErrorMessage = null
    try {
      await mailer.sendWelcomeEmail({
        to: email,
        name: data.name,
        rollNo,
        tempPassword,
        loginUrl,
      })
    } catch (err) {
      emailStatus = 'failed'
      emailErrorMessage = err?.message || 'Unknown mail error'
      console.error(
        `[CampusLedger] Welcome email failed for ${email}: ${err?.code || ''} ${emailErrorMessage}`
      )
    }

    const student = db.prepare(`SELECT ${studentColumns} FROM students WHERE id = ?`).get(newId)

    const payload = {
      student: publicStudent(student),
      email_status: emailStatus,
      email_warning: null,
      temp_password: null,
      message: '',
    }

    if (emailStatus === 'failed') {
      payload.message = 'Student created, but the welcome email could not be sent.'
      payload.email_warning = `The welcome email failed to deliver (${emailErrorMessage}). Show the temporary password below to the student now - it will not be shown again.`
      payload.temp_password = tempPassword
    } else if (mailer.mode === 'dev') {
      payload.message = 'Student created. Email is running in dev mode (printed in the server console).'
      payload.email_warning = 'Dev mode does not send real emails. Share the temporary password below with the student.'
      payload.temp_password = tempPassword
    } else {
      payload.message = `Student created. Login details emailed to ${email}.`
    }

    return res.status(201).json(payload)
  }))

  router.delete('/students/:id', asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      return sendError(res, 404, 'Student not found.')
    }
    const student = db
      .prepare('SELECT id, name, roll_no FROM students WHERE id = ?')
      .get(id)
    if (!student) {
      return sendError(res, 404, 'Student not found.')
    }
    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM attendance WHERE student_id = ?').run(id)
      db.prepare('DELETE FROM students WHERE id = ?').run(id)
    })
    deleteAll()
    return res.json({ message: `${student.name} has been deleted.`, deleted: student })
  }))

  router.get('/attendance', (req, res) => {
    const parsed = attendanceQuerySchema.safeParse({
      class: req.query.class,
      section: req.query.section,
      date: req.query.date,
    })
    if (!parsed.success) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: firstFieldErrors(parsed.error) })
    }
    const { class: className, section, date } = parsed.data
    const roster = db
      .prepare(
        'SELECT id, name, roll_no, email FROM students WHERE class = ? AND section = ? ORDER BY roll_no'
      )
      .all(className, section)
    const markStmt = db.prepare('SELECT status FROM attendance WHERE student_id = ? AND date = ?')
    const students = roster.map((student) => {
      const mark = markStmt.get(student.id, date)
      return { ...student, status: mark ? mark.status : null }
    })
    const present = students.filter((s) => s.status === 'present').length
    const absent = students.filter((s) => s.status === 'absent').length
    res.json({
      class: className,
      section,
      date,
      students,
      counts: {
        total: students.length,
        present,
        absent,
        unmarked: students.length - present - absent,
      },
    })
  })

  router.put('/attendance', asyncHandler(async (req, res) => {
    const parsed = attendanceSaveSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: firstFieldErrors(parsed.error) })
    }
    const { class: className, section, date, records } = parsed.data

    const roster = db
      .prepare('SELECT id, name, roll_no, email FROM students WHERE class = ? AND section = ?')
      .all(className, section)
    if (roster.length === 0) {
      return sendError(res, 400, 'No students found in that class and section.', {
        fieldErrors: { section: 'No students are enrolled in this class and section.' },
      })
    }

    const rosterIds = new Set(roster.map((s) => s.id))
    const statusById = new Map()
    for (const record of records) {
      if (!rosterIds.has(record.student_id)) {
        return sendError(res, 400, 'One or more attendance records do not belong to this class and section.', {
          fieldErrors: { records: 'Roster mismatch - a student id does not belong to this class and section.' },
        })
      }
      statusById.set(record.student_id, record.status)
    }
    if (statusById.size === 0) {
      return sendError(res, 400, 'Validation failed.', {
        fieldErrors: { records: 'Provide at least one attendance record.' },
      })
    }

    const upsert = db.prepare(
      `INSERT INTO attendance (student_id, date, status, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`
    )
    const saveAll = db.transaction(() => {
      for (const [studentId, status] of statusById) upsert.run(studentId, date, status)
    })
    saveAll()

    const statusStmt = db.prepare('SELECT status FROM attendance WHERE student_id = ? AND date = ?')
    let sent = 0
    let failed = 0
    for (const student of roster) {
      const mark = statusStmt.get(student.id, date)
      try {
        await mailer.sendAttendanceEmail({
          to: student.email,
          name: student.name,
          rollNo: student.roll_no,
          className,
          section,
          date,
          status: mark ? mark.status : null,
        })
        sent += 1
      } catch (err) {
        failed += 1
        console.error(
          `[CampusLedger] Attendance email failed for ${student.email} on ${date}: ${err?.code || ''} ${err?.message || 'unknown error'}`
        )
      }
    }

    return res.json({
      message: 'Attendance saved.',
      saved: statusById.size,
      roster_total: roster.length,
      date_display: formatDateHuman(date),
      emails: { sent, failed },
    })
  }))

  router.get('/assignments', (req, res) => {
    const rows = db.prepare('SELECT * FROM assignments ORDER BY uploaded_at DESC, id DESC').all()
    res.json({
      assignments: rows.map((row) => publicAssignment(row, `/api/admin/assignments/${row.id}/download`)),
    })
  })

  router.post('/assignments', upload.single('file'), asyncHandler(async (req, res) => {
    const parsed = assignmentMetaSchema.safeParse({
      title: req.body?.title,
      class: req.body?.class,
      section: req.body?.section,
    })
    if (!parsed.success) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: firstFieldErrors(parsed.error) })
    }
    const file = req.file
    if (!file) {
      return sendError(res, 400, 'Validation failed.', { fieldErrors: { file: 'Choose a file to upload.' } })
    }
    const validation = validateAssignmentFile(file, config.maxAssignmentBytes)
    if (!validation.ok) {
      return sendError(res, validation.tooLarge ? 413 : 400, validation.error, {
        fieldErrors: { file: validation.error },
      })
    }

    const storedFilename = `${crypto.randomUUID().replace(/-/g, '')}${validation.ext}`
    const uploadsDir = path.resolve(config.uploadsDir)
    const target = path.join(uploadsDir, storedFilename)
    await fs.mkdir(uploadsDir, { recursive: true })
    await fs.writeFile(target, file.buffer)

    try {
      const info = db
        .prepare(
          `INSERT INTO assignments (title, class, section, original_filename, stored_filename, mime_type, size_bytes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          parsed.data.title,
          parsed.data.class,
          parsed.data.section,
          path.basename(String(file.originalname)),
          storedFilename,
          validation.mime,
          file.size
        )
      const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(info.lastInsertRowid)
      return res.status(201).json({
        assignment: publicAssignment(row, `/api/admin/assignments/${row.id}/download`),
        message: 'Assignment uploaded.',
      })
    } catch (err) {
      await fs.unlink(target).catch(() => {})
      throw err
    }
  }))

  router.get('/assignments/:id/download', (req, res) => {
    const id = Number(req.params.id)
    const row = Number.isInteger(id) && id > 0
      ? db.prepare('SELECT * FROM assignments WHERE id = ?').get(id)
      : null
    if (!row) return sendError(res, 404, 'Assignment not found.')
    return sendFileDownload(res, config.uploadsDir, row.stored_filename, row.original_filename)
  })

  return router
}
