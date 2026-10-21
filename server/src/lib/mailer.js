import nodemailer from 'nodemailer'
import { formatDateHuman } from './datetime.js'

export function renderWelcomeEmail({ name, rollNo, tempPassword, loginUrl }) {
  const subject = 'Welcome to CampusLedger - Your Student Login'
  const text = [
    `Hello ${name},`,
    '',
    'Your CampusLedger student account has been created. Use these details to sign in:',
    '',
    `  Roll number: ${rollNo}`,
    `  Temporary password: ${tempPassword}`,
    `  Login URL: ${loginUrl}`,
    '',
    'Sign in at the Student Login page with your roll number and the temporary password above.',
    'You will be required to change this password the first time you sign in.',
    '',
    '- CampusLedger Administration',
  ].join('\n')
  const html = `
    <div style="font-family:Georgia,serif;color:#1d2533;background:#faf7ef;padding:24px;border:1px solid #e4dcc8">
      <h2 style="color:#122a52;margin:0 0 12px">CampusLedger</h2>
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p>Your student account has been created. Use these details to sign in:</p>
      <table style="border-collapse:collapse;background:#fff;border:1px solid #e4dcc8">
        <tr><td style="padding:8px 14px;border-bottom:1px solid #e4dcc8;color:#5c6470">Roll number</td><td style="padding:8px 14px;font-weight:bold">${escapeHtml(rollNo)}</td></tr>
        <tr><td style="padding:8px 14px;border-bottom:1px solid #e4dcc8;color:#5c6470">Temporary password</td><td style="padding:8px 14px;font-weight:bold">${escapeHtml(tempPassword)}</td></tr>
        <tr><td style="padding:8px 14px;color:#5c6470">Login URL</td><td style="padding:8px 14px"><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></td></tr>
      </table>
      <p>You will be required to change this password the first time you sign in.</p>
      <p style="color:#5c6470">- CampusLedger Administration</p>
    </div>`
  return { subject, text, html }
}

export function renderAttendanceEmail({ name, rollNo, className, section, date, status }) {
  const statusLabel = status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : 'Not marked'
  const subject = `Attendance Update - ${className} ${section} - ${formatDateHuman(date)}`
  const text = [
    `Hello ${name},`,
    '',
    'This is your attendance update from CampusLedger:',
    '',
    `  Student name: ${name}`,
    `  Roll number: ${rollNo}`,
    `  Date: ${formatDateHuman(date)} (${date})`,
    `  Class: ${className}`,
    `  Section: ${section}`,
    `  Status: ${statusLabel}`,
    '',
    '- CampusLedger Administration',
  ].join('\n')
  const html = `
    <div style="font-family:Georgia,serif;color:#1d2533;background:#faf7ef;padding:24px;border:1px solid #e4dcc8">
      <h2 style="color:#122a52;margin:0 0 12px">Attendance Update</h2>
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <table style="border-collapse:collapse;background:#fff;border:1px solid #e4dcc8">
        <tr><td style="padding:8px 14px;border-bottom:1px solid #e4dcc8;color:#5c6470">Student name</td><td style="padding:8px 14px">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 14px;border-bottom:1px solid #e4dcc8;color:#5c6470">Roll number</td><td style="padding:8px 14px">${escapeHtml(rollNo)}</td></tr>
        <tr><td style="padding:8px 14px;border-bottom:1px solid #e4dcc8;color:#5c6470">Date</td><td style="padding:8px 14px">${escapeHtml(formatDateHuman(date))} (${escapeHtml(date)})</td></tr>
        <tr><td style="padding:8px 14px;border-bottom:1px solid #e4dcc8;color:#5c6470">Class</td><td style="padding:8px 14px">${escapeHtml(className)}</td></tr>
        <tr><td style="padding:8px 14px;border-bottom:1px solid #e4dcc8;color:#5c6470">Section</td><td style="padding:8px 14px">${escapeHtml(section)}</td></tr>
        <tr><td style="padding:8px 14px;color:#5c6470">Status</td><td style="padding:8px 14px;font-weight:bold;color:${status === 'present' ? '#1e5b3c' : status === 'absent' ? '#7c1d2b' : '#5c6470'}">${statusLabel}</td></tr>
      </table>
      <p style="color:#5c6470">- CampusLedger Administration</p>
    </div>`
  return { subject, text, html }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createTransport(config) {
  if (config.mailTransport === 'smtp') {
    const options = {
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
    }
    if (config.smtp.user && config.smtp.pass) {
      options.auth = { user: config.smtp.user, pass: config.smtp.pass }
    }
    return nodemailer.createTransport(options)
  }
  return {
    async sendMail(mail) {
      console.log(`[CampusLedger mail:dev] to=${mail.to}\nsubject: ${mail.subject}\n\n${mail.text}\n`)
      return { dev: true, messageId: `dev-${Date.now()}` }
    },
  }
}

export function createMailer(config, { transport } = {}) {
  const activeTransport = transport || createTransport(config)
  return {
    mode: transport ? 'injected' : config.mailTransport,
    transport: activeTransport,
    async sendWelcomeEmail(params) {
      const { subject, text, html } = renderWelcomeEmail(params)
      return activeTransport.sendMail({ from: config.mailFrom, to: params.to, subject, text, html })
    },
    async sendAttendanceEmail(params) {
      const { subject, text, html } = renderAttendanceEmail(params)
      return activeTransport.sendMail({ from: config.mailFrom, to: params.to, subject, text, html })
    },
  }
}
