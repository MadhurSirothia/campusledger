import { Link } from 'react-router-dom'
import { Crest } from '../components/AppShell.jsx'

export default function Landing() {
  return (
    <div className="landing">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="landing-header">
        <div className="landing-brand">
          <Crest size="md" />
          <div>
            <span className="landing-wordmark">CampusLedger</span>
            <span className="landing-tagline">College Attendance Portal</span>
          </div>
        </div>
        <span className="landing-session-note">Attendance · Records · Assignments</span>
      </header>

      <main id="main" className="landing-main">
        <section className="landing-hero">
          <p className="kicker">Established for B.Tech &amp; M.Tech</p>
          <h1>Attendance, recorded with purpose.</h1>
          <p className="landing-lead">
            CampusLedger keeps the register honest — daily attendance for every class and section,
            email notices to students, and a single ledger for assignments.
          </p>
          <div className="rule-gold" aria-hidden="true" />
        </section>

        <section className="choice-grid" aria-label="Choose how to sign in">
          <article className="choice-card">
            <p className="choice-eyebrow">Faculty &amp; Administration</p>
            <h2>Administrator login</h2>
            <p>
              Sign in with the college-issued admin email and password to manage students,
              take attendance, and upload assignments.
            </p>
            <Link className="btn btn-navy" to="/admin/login">
              Administrator sign in
            </Link>
          </article>

          <article className="choice-card">
            <p className="choice-eyebrow">Students</p>
            <h2>Student login</h2>
            <p>
              Sign in with your roll number and the password emailed to you. First-time users
              are asked to set a new password.
            </p>
            <Link className="btn btn-gold" to="/student/login">
              Student sign in
            </Link>
          </article>
        </section>

        <section className="landing-facts" aria-label="Portal coverage">
          <div className="fact">
            <span className="fact-label">Classes</span>
            <span className="fact-value">B.Tech · M.Tech</span>
          </div>
          <div className="fact">
            <span className="fact-label">Sections</span>
            <span className="fact-value">CSE · AIML · IT · Civil</span>
          </div>
          <div className="fact">
            <span className="fact-label">Notices</span>
            <span className="fact-value">Daily attendance emails</span>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>© 2026 CampusLedger. Register maintained in the Classic College tradition.</p>
      </footer>
    </div>
  )
}
