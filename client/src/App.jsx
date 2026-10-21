import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { RequireAdmin, RequireStudent } from './auth.jsx'
import { AdminShell, StudentShell } from './components/AppShell.jsx'
import Landing from './pages/Landing.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import StudentLogin from './pages/StudentLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminRecords from './pages/AdminRecords.jsx'
import AdminAssignments from './pages/AdminAssignments.jsx'
import ManageStudents from './pages/ManageStudents.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import StudentAssignments from './pages/StudentAssignments.jsx'
import ChangePassword from './pages/ChangePassword.jsx'

function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card narrow">
        <span className="crest crest-md" aria-hidden="true"><span className="crest-inner">CL</span></span>
        <h1 className="auth-title">Page not found</h1>
        <p className="auth-sub">The page you requested does not exist.</p>
        <Link className="btn btn-primary" to="/">Return home</Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/student/login" element={<StudentLogin />} />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminShell />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="records" element={<AdminRecords />} />
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="students" element={<ManageStudents />} />
      </Route>

      <Route
        path="/student"
        element={
          <RequireStudent>
            <StudentShell />
          </RequireStudent>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="assignments" element={<StudentAssignments />} />
      </Route>

      <Route
        path="/student/change-password"
        element={
          <RequireStudent allowPasswordChange>
            <ChangePassword />
          </RequireStudent>
        }
      />

      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
