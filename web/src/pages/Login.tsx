import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { setToken } from '../auth'

export function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as { access_token?: string; error?: string }
      if (!res.ok) {
        if (data.error === 'email_not_verified') {
          setErr('Email belum dikonfirmasi. Cek kotak masuk atau halaman konfirmasi.')
          return
        }
        setErr(data.error ?? 'gagal masuk')
        return
      }
      if (!data.access_token) {
        setErr('token tidak ada')
        return
      }
      setToken(data.access_token)
      nav('/dashboard', { replace: true })
    } catch {
      setErr('tidak terhubung ke API — pastikan backend jalan & CORS.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="card narrow">
        <h1>Masuk</h1>
        <form onSubmit={onSubmit} className="form">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Sandi
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          {err && <p className="error">{err}</p>}
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? '…' : 'Masuk'}
          </button>
        </form>
        <p className="muted small">
          Belum punya akun? <Link to="/register">Daftar</Link> ·{' '}
          <Link to="/verify-email">Konfirmasi email</Link>
        </p>
        <p className="muted small">
          <Link to="/">← Beranda</Link>
        </p>
      </div>
    </div>
  )
}
