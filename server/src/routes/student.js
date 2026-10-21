import { Router } from 'express'
import { sendError } from '../lib/errors.js'
import { publicAssignment, publicStudent } from '../lib/serialize.js'
import { sendFileDownload } from '../lib/files.js'
import { todayISO } from '../lib/datetime.js'

function attendanceTotals(db, studentId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS marked_days,
              COALESCE(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END), 0) AS present_days
       FROM attendance WHERE student_id = ?`
    )
    .get(studentId)
  const present = row.present_days || 0
  const marked = row.marked_days || 0
  const percentage = marked > 0 ? Math.round((present / marked) * 1000) / 10 : 0
  return { present_days: present, marked_days: marked, percentage }
}

export function studentRoutes({ config, db, auth }) {
  const router = Router()
  const requireStudent = auth.requireStudent()

  router.get('/overview', requireStudent, (req, res) => {
    const student = req.user.student
    const totals = attendanceTotals(db, student.id)
    const date = todayISO()
    const todayMark = db
      .prepare('SELECT status FROM attendance WHERE student_id = ? AND date = ?')
      .get(student.id, date)
    const assignmentsCount = db
      .prepare('SELECT COUNT(*) AS count FROM assignments WHERE class = ? AND section = ?')
      .get(student.class, student.section).count

    res.json({
      student: publicStudent(student),
      attendance: {
        date,
        today_status: todayMark ? todayMark.status : null,
        ...totals,
      },
      assignments_count: assignmentsCount,
    })
  })

  router.get('/attendance', requireStudent, (req, res) => {
    const student = req.user.student
    const totals = attendanceTotals(db, student.id)
    const date = todayISO()
    const todayMark = db
      .prepare('SELECT status FROM attendance WHERE student_id = ? AND date = ?')
      .get(student.id, date)
    const records = db
      .prepare(
        'SELECT date, status, updated_at FROM attendance WHERE student_id = ? ORDER BY date DESC, updated_at DESC LIMIT 30'
      )
      .all(student.id)

    res.json({
      student: publicStudent(student),
      today: { date, status: todayMark ? todayMark.status : null },
      totals,
      records,
    })
  })

  router.get('/assignments', requireStudent, (req, res) => {
    const student = req.user.student
    const rows = db
      .prepare(
        `SELECT id, title, class, section, original_filename, mime_type, size_bytes, uploaded_at
         FROM assignments WHERE class = ? AND section = ?
         ORDER BY uploaded_at DESC, id DESC`
      )
      .all(student.class, student.section)
    res.json({
      assignments: rows.map((row) => publicAssignment(row, `/api/student/assignments/${row.id}/download`)),
    })
  })

  router.get('/assignments/:id/download', requireStudent, (req, res) => {
    const student = req.user.student
    const id = Number(req.params.id)
    const row = Number.isInteger(id) && id > 0
      ? db.prepare('SELECT * FROM assignments WHERE id = ?').get(id)
      : null
    if (!row) return sendError(res, 404, 'Assignment not found.')
    if (row.class !== student.class || row.section !== student.section) {
      return sendError(res, 403, 'You are not authorized to download this assignment.')
    }
    return sendFileDownload(res, config.uploadsDir, row.stored_filename, row.original_filename)
  })

  return router
}
