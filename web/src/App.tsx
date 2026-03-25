import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Dashboard } from './pages/Dashboard'
import { InvitationStudio } from './pages/InvitationStudio'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { PublicInvite } from './pages/PublicInvite'
import { Register } from './pages/Register'
import { VerifyEmail } from './pages/VerifyEmail'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/invitations/:id"
        element={
          <ProtectedRoute>
            <InvitationStudio />
          </ProtectedRoute>
        }
      />
      <Route path="/i/:slug" element={<PublicInvite />} />
      <Route
        path="/preview/:id"
        element={
          <ProtectedRoute>
            <PublicInvite />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
