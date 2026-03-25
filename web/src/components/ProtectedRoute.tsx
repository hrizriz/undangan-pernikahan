import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getToken } from '../auth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const t = getToken()
  if (!t) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
