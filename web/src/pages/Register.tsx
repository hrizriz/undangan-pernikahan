import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'

export function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as {
        message?: string
        error?: string
        email?: string
      }
      if (!res.ok) {
        if (data.error === 'email_taken') {
          setErr('Email sudah terdaftar.')
        } else {
          setErr(data.error ?? 'gagal daftar')
        }
        return
      }
      if (data.message === 'pending_verification') {
        setDone(true)
        return
      }
      setErr('respons tidak dikenal')
    } catch {
      setErr('tidak terhubung ke API.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="page">
        <div className="card narrow">
          <h1>Cek email kamu</h1>
          <p className="muted">
            Kami mengirim tautan konfirmasi ke <strong>{email}</strong>. Klik tautan itu untuk mengaktifkan
            akun, lalu masuk lewat halaman login.
          </p>
          <p className="muted small">
            Mode pengembangan: cek juga <strong>terminal backend</strong> — link verifikasi ikut dicetak di
            log jika email SMTP belum diset.
          </p>
          <p>
            <Link className="btn primary" to="/verify-email">
              Buka halaman konfirmasi
            </Link>
          </p>
          <p className="muted small">
            <Link to="/login">Ke halaman masuk</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card narrow">
        <h1>Daftar</h1>
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
            Sandi (min. 8 karakter)
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          {err && <p className="error">{err}</p>}
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? '…' : 'Kirim konfirmasi email'}
          </button>
        </form>
        <p className="muted small">
          Sudah punya akun? <Link to="/login">Masuk</Link>
        </p>
        <p className="muted small">
          <Link to="/">← Beranda</Link>
        </p>
      </div>
    </div>
  )
}
