import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api'
import { setToken } from '../auth'

export function VerifyEmail() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [token, setTok] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = params.get('token')
    if (t) setTok(t)
  }, [params])

  async function verify(t: string) {
    setErr(null)
    setMsg(null)
    setLoading(true)
    try {
      const res = await apiFetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t.trim() }),
      })
      const data = (await res.json()) as { access_token?: string; error?: string }
      if (!res.ok) {
        if (data.error === 'invalid_or_expired_token') {
          setErr('Tautan tidak valid atau sudah kedaluwarsa.')
        } else {
          setErr(data.error ?? 'gagal verifikasi')
        }
        return
      }
      if (!data.access_token) {
        setErr('token tidak ada')
        return
      }
      setToken(data.access_token)
      setMsg('Email terkonfirmasi. Mengalihkan…')
      setTimeout(() => nav('/dashboard', { replace: true }), 700)
    } catch {
      setErr('tidak terhubung ke API')
    } finally {
      setLoading(false)
    }
  }

  function onManual(e: FormEvent) {
    e.preventDefault()
    void verify(token)
  }

  return (
    <div className="page">
      <div className="card narrow">
        <h1>Konfirmasi email</h1>
        {msg && <p className="ok">{msg}</p>}
        <p className="muted small">
          Buka tautan dari email, atau tempel token di bawah lalu konfirmasi.
        </p>
        <form onSubmit={onManual} className="form">
          <label>
            Token
            <input
              value={token}
              onChange={(e) => setTok(e.target.value)}
              placeholder="dari ?token= di URL"
            />
          </label>
          {err && <p className="error">{err}</p>}
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? '…' : 'Konfirmasi'}
          </button>
        </form>
        <p className="muted small">
          <Link to="/login">Sudah konfirmasi? Masuk</Link>
        </p>
        <p className="muted small">
          <Link to="/">← Beranda</Link>
        </p>
      </div>
    </div>
  )
}
