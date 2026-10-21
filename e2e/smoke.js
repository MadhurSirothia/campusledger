/*
 * CampusLedger end-to-end smoke test (8-step demo flow).
 *
 * Prerequisites:
 *   1. Fresh DB: rm -f server/data/campusledger.sqlite*
 *   2. Servers running: npm run dev   (API :4000, web app :5173)
 *   3. Playwright available to Node: npm i -D playwright && npx playwright install chromium
 *
 * Run:  npm run e2e            (or: node e2e/smoke.js)
 * Env:  BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD override defaults.
 */
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const ARTIFACTS = path.join(os.tmpdir(), 'campusledger-e2e')
const SHOTS = path.join(ARTIFACTS, 'shots')
const DL_PATH = path.join(ARTIFACTS, 'downloaded-assignment.png')
const PNG_PATH = path.join(ARTIFACTS, 'e2e-assignment.png')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@campusledger.edu'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@Campus123'
const ROLL = 'E2E001'
const STUDENT_NAME = 'E2E Student'
const NEW_PASSWORD = 'E2ePassw0rd9'

fs.mkdirSync(SHOTS, { recursive: true })

let pageRef = null
let currentStep = 'startup'

function expect(cond, message) {
  if (!cond) throw new Error(message)
  console.log(`  ok: ${message}`)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
  console.log(`  screenshot: ${name}.png`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  pageRef = page

  currentStep = 'STEP 0: landing page'
  console.log(currentStep)
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  const h1 = await page.locator('h1').first().innerText()
  expect(h1.startsWith('Attendance'), `landing headline rendered (${h1})`)
  expect((await page.getByRole('link', { name: 'Administrator sign in' }).count()) === 1, 'admin login choice present')
  expect((await page.getByRole('link', { name: 'Student sign in' }).count()) === 1, 'student login choice present')
  await shot(page, '01-landing')

  currentStep = 'STEP 1: admin logs in'
  console.log(currentStep)
  await page.getByRole('link', { name: 'Administrator sign in' }).click()
  await page.waitForURL('**/admin/login')
  await page.fill('#admin-email', ADMIN_EMAIL)
  await page.fill('#admin-password', ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in as administrator' }).click()
  await page.waitForURL('**/admin')
  await page.waitForSelector('.stat-card:not(.skeleton)')
  const title = await page.locator('.page-title').innerText()
  expect(title === 'Administrator dashboard', `admin dashboard reached (${title})`)
  expect((await page.locator('.stat-card').count()) >= 4, 'four summary cards rendered')
  await shot(page, '02-admin-dashboard')

  currentStep = 'STEP 2: admin creates a student'
  console.log(currentStep)
  await page.getByRole('button', { name: 'Add student', exact: true }).click()
  await page.waitForSelector('#student-name')
  await page.fill('#student-name', STUDENT_NAME)
  await page.fill('#student-roll', ROLL)
  await page.fill('#student-phone', '9876543210')
  await page.fill('#student-email', 'e2e.student@example.com')
  const [createResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/admin/students') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save student' }).click(),
  ])
  expect(createResp.status() === 201, `student created (HTTP ${createResp.status()})`)
  const created = await createResp.json()
  expect(!!created.temp_password, 'create response carries a temporary password (dev mailer)')
  const tempPassword = created.temp_password.trim()
  expect(tempPassword.length >= 8, 'temporary password captured (not printed)')
  await page.waitForSelector('.warning-box')
  const warning = await page.locator('.warning-box .warning-title').innerText()
  expect(warning.toLowerCase().includes('password'), `shown-once warning displayed (${warning.slice(0, 60)}...)`)
  const panelText = await page.locator('.success-panel').innerText()
  expect(panelText.includes(STUDENT_NAME), 'success panel names the student')
  await shot(page, '03-add-student-success')
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForSelector('.modal-backdrop', { state: 'detached' })

  currentStep = 'STEP 3: admin takes attendance'
  console.log(currentStep)
  await page.getByRole('button', { name: 'Take attendance', exact: true }).click()
  await page.waitForSelector('#att-date')
  await page.getByRole('button', { name: 'Load roster' }).click()
  await page.waitForSelector('.roster-table')
  expect((await page.locator('.roster-table tbody tr').count()) === 1, 'roster shows the new student (1 row)')
  expect((await page.locator('.toggle.present.on').count()) === 1, 'roster defaults to present')
  await page.getByRole('button', { name: 'Mark all absent' }).click()
  expect((await page.locator('.toggle.absent.on').count()) === 1, 'mark all absent shortcut works')
  await page.getByRole('button', { name: 'Mark all present' }).click()
  expect((await page.locator('.toggle.present.on').count()) === 1, 'mark all present shortcut works')
  await shot(page, '04-take-attendance')
  await page.getByRole('button', { name: 'Save attendance' }).click()
  const savedToast = page.locator('.toast', { hasText: 'Attendance saved' }).first()
  await savedToast.waitFor({ state: 'visible' })
  const toastText = await savedToast.innerText()
  expect(toastText.toLowerCase().includes('failed 0'), `save reported email counts (${toastText.split('\n')[0]})`)
  await page.waitForSelector('.modal-backdrop', { state: 'detached' })

  await page.getByRole('button', { name: 'Take attendance', exact: true }).click()
  await page.getByRole('button', { name: 'Load roster' }).click()
  await page.waitForSelector('.warning-inline')
  const resend = await page.locator('.warning-inline').innerText()
  expect(resend.includes('re-send'), 'resend warning shown for already-saved date')
  await page.keyboard.press('Escape')
  await page.waitForSelector('.modal-backdrop', { state: 'detached' })
  expect((await page.locator('.modal-backdrop').count()) === 0, 'Escape closes the modal')

  currentStep = 'STEP 4: admin views student records'
  console.log(currentStep)
  await page.getByRole('link', { name: 'Student Records', exact: true }).click()
  await page.waitForURL('**/admin/records')
  await page.waitForSelector('.count-bar')
  const counts = (await page.locator('.count-bar').innerText()).split(/\s+/).join(' ')
  expect(counts.includes('1 present'), `records show 1 present (${counts})`)
  await page.locator('.chip-present').first().waitFor({ state: 'visible' })
  expect((await page.locator('.chip-present').count()) === 1, 'student marked present in table')
  expect(!(await page.locator('tbody').innerText()).includes('Not marked'), 'no unmarked rows')
  await shot(page, '05-student-records')

  currentStep = 'STEP 5: admin uploads an assignment'
  console.log(currentStep)
  fs.writeFileSync(PNG_PATH, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('campusledger-e2e'.repeat(32))]))
  await page.getByRole('link', { name: 'Upload assignment' }).click()
  await page.waitForURL('**/admin/assignments')
  await page.fill('#assignment-title', 'E2E Lab Manual')
  await page.setInputFiles('#assignment-file', PNG_PATH)
  await page.getByRole('button', { name: 'Upload assignment' }).click()
  await page.getByText('uploaded for B.Tech CSE').waitFor({ state: 'visible' })
  expect((await page.locator('.assignment-row', { hasText: 'E2E Lab Manual' }).count()) === 1, 'assignment appears in the admin list')
  await shot(page, '06-upload-assignment')

  currentStep = 'STEP 6: student logs in with temporary credentials and changes password'
  console.log(currentStep)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(`${BASE}/`)
  await page.getByRole('link', { name: 'Student sign in' }).click()
  await page.waitForURL('**/student/login')
  await page.fill('#student-roll', ROLL)
  await page.fill('#student-password', tempPassword)
  await page.getByRole('button', { name: 'Sign in as student' }).click()
  await page.waitForURL('**/student/change-password')
  const changeText = await page.locator('.auth-sub').innerText()
  expect(changeText.includes('first sign-in'), 'forced change-password screen shown')
  await page.fill('#current-password', tempPassword)
  await page.fill('#new-password', NEW_PASSWORD)
  await page.fill('#confirm-password', NEW_PASSWORD)
  await page.getByRole('button', { name: 'Set new password' }).click()
  await page.waitForURL('**/student')
  await page.waitForSelector('.page-title')
  const greeting = await page.locator('.page-title').innerText()
  expect(greeting.includes('E2E'), `student dashboard reached (${greeting})`)
  expect((await page.locator('.stat-card').count()) >= 3, 'student summary cards rendered')
  await shot(page, '07-student-dashboard')

  currentStep = 'STEP 7: student attendance views + assignment download'
  console.log(currentStep)
  await page.getByRole('button', { name: 'Show my attendance' }).click()
  await page.waitForSelector('#panel-today')
  const todayText = await page.locator('#panel-today').innerText()
  expect(todayText.toLowerCase().includes('present'), `today view shows Present (${todayText.split('\n')[0]})`)
  await shot(page, '08-student-today')
  await page.getByRole('tab', { name: 'Total attendance' }).click()
  const totalText = await page.locator('#panel-total').innerText()
  expect(totalText.includes('100%'), 'total view shows 100%')
  expect(totalText.includes('1'), 'total view shows 1 present day')
  await shot(page, '09-student-total')
  await page.keyboard.press('Escape')
  await page.waitForSelector('.modal-backdrop', { state: 'detached' })

  await page.getByRole('link', { name: 'My Assignments', exact: true }).click()
  await page.waitForURL('**/student/assignments')
  await page.waitForSelector('.assignment-row')
  expect((await page.locator('.assignment-row', { hasText: 'E2E Lab Manual' }).count()) === 1, 'student sees their class assignment')
  expect((await page.locator('.assignment-row').count()) === 1, "only the student's class/section assignments are listed")
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download E2E Lab Manual' }).click(),
  ])
  await download.saveAs(DL_PATH)
  const size = fs.statSync(DL_PATH).size
  expect(size > 0, `assignment downloaded (${size} bytes)`)
  await shot(page, '10-student-assignments')

  currentStep = 'STEP 8: admin deletes the student; access removed'
  console.log(currentStep)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(`${BASE}/`)
  await page.getByRole('link', { name: 'Administrator sign in' }).click()
  await page.waitForURL('**/admin/login')
  await page.fill('#admin-email', ADMIN_EMAIL)
  await page.fill('#admin-password', ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in as administrator' }).click()
  await page.waitForURL('**/admin')
  await page.getByRole('link', { name: 'Manage students' }).click()
  await page.waitForURL('**/admin/students')
  const row = page.locator('tr', { hasText: ROLL })
  await row.first().waitFor({ state: 'visible' })
  expect((await row.count()) === 1, 'student listed on the manage page')
  await row.getByRole('button', { name: `Delete ${STUDENT_NAME}` }).click()
  await page.waitForSelector('[role=dialog]')
  const dialogText = await page.locator('[role=dialog]').innerText()
  expect(dialogText.includes('cannot be undone'), 'confirmation dialog shown')
  await shot(page, '11-delete-confirm')
  await page.getByRole('button', { name: 'Delete student', exact: true }).click()
  await row.first().waitFor({ state: 'detached' })
  expect((await page.locator('tr', { hasText: ROLL }).count()) === 0, 'student removed from the list')
  await shot(page, '12-after-delete')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(`${BASE}/`)
  await page.getByRole('link', { name: 'Student sign in' }).click()
  await page.waitForURL('**/student/login')
  await page.fill('#student-roll', ROLL)
  await page.fill('#student-password', NEW_PASSWORD)
  await page.getByRole('button', { name: 'Sign in as student' }).click()
  await page.waitForSelector('.form-banner')
  const err = await page.locator('.form-banner').innerText()
  expect(err.includes('Invalid roll number or password'), `deleted student cannot log in (${err})`)
  expect(page.url().endsWith('/student/login'), 'student stayed on the login page')
  await shot(page, '13-student-login-after-delete')

  await ctx.close()
  await browser.close()
  console.log('\nALL 8 E2E STEPS PASSED')
}

main().catch(async (err) => {
  console.error(`\nE2E FAILED during [${currentStep}]: ${err.message}`)
  if (pageRef) {
    try {
      await pageRef.screenshot({ path: path.join(SHOTS, 'FAILURE.png'), fullPage: true })
      console.error('  failure screenshot: FAILURE.png')
      console.error('  page text:\n' + (await pageRef.locator('body').innerText()).slice(0, 800))
    } catch {}
  }
  process.exit(1)
})
