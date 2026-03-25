import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'
import { clearToken, getToken } from '../auth'
import { getExampleSlidesPayload } from '../data/exampleSlides'
import type { InvitationSummary } from '../types'

export function Dashboard() {
  const token = getToken()
  const [list, setList] = useState<InvitationSummary[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pubBusy, setPubBusy] = useState<string | null>(null)
  const [exampleBusy, setExampleBusy] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    if (!token) return
    const res = await apiFetch('/api/v1/invitations', { token })
    const data = (await res.json()) as { invitations?: InvitationSummary[]; error?: string }
    if (!res.ok) {
      setErr(data.error ?? 'gagal memuat')
      setList([])
      return
    }
    setErr(null)
    setList(data.invitations ?? [])
  }, [token])

  useEffect(() => {
    loadList()
  }, [loadList])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setCreateErr(null)
    setCreating(true)
    try {
      const res = await apiFetch('/api/v1/invitations', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(),
          title: title.trim() || '',
        }),
      })
      const data = (await res.json()) as { error?: string; slug?: string }
      if (!res.ok) {
        if (data.error === 'slug_taken') {
          setCreateErr('Slug sudah dipakai, ganti yang lain.')
        } else {
          setCreateErr(data.error ?? 'gagal membuat undangan')
        }
        return
      }
      setSlug('')
      setTitle('')
      await loadList()
    } catch {
      setCreateErr('tidak terhubung ke API')
    } finally {
      setCreating(false)
    }
  }

  async function publish(id: string) {
    if (!token) return
    setPubBusy(id)
    setErr(null)
    try {
      const res = await apiFetch(`/api/v1/invitations/${id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: true }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErr(data.error ?? 'gagal menerbitkan')
        return
      }
      await loadList()
    } catch {
      setErr('tidak terhubung ke API')
    } finally {
      setPubBusy(null)
    }
  }

  async function deleteInvitation(invId: string, label: string) {
    if (!token) return
    if (
      !window.confirm(
        `Hapus undangan "${label}" beserta slide, tamu, dan RSVP? Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return
    }
    setDeleteBusy(invId)
    setErr(null)
    try {
      const res = await apiFetch(`/api/v1/invitations/${invId}`, {
        method: 'DELETE',
        token,
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setErr(data.error ?? 'gagal menghapus')
        return
      }
      await loadList()
    } catch {
      setErr('tidak terhubung ke API')
    } finally {
      setDeleteBusy(null)
    }
  }

  async function applyExampleSlides(invId: string) {
    if (!token) return
    if (
      !window.confirm(
        'Ini akan mengganti semua slide undangan dengan contoh (cover + daftar fitur + penutup). Lanjut?',
      )
    ) {
      return
    }
    setExampleBusy(invId)
    setErr(null)
    try {
      const res = await apiFetch(`/api/v1/invitations/${invId}/slides`, {
        method: 'PUT',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getExampleSlidesPayload()),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErr(data.error ?? 'gagal memasang contoh')
        return
      }
    } catch {
      setErr('tidak terhubung ke API')
    } finally {
      setExampleBusy(null)
    }
  }

  function logout() {
    clearToken()
    window.location.href = '/login'
  }

  return (
    <div className="page dashboard">
      <header className="topbar">
        <h1>Undangan saya</h1>
        <button type="button" className="btn ghost" onClick={logout}>
          Keluar
        </button>
      </header>

      <section className="card create-box">
        <h2 className="h2">Buat undangan</h2>
        <p className="muted small">
          Slug dipakai di URL tamu: <code>/i/slug-kamu</code> (huruf kecil, angka, tanda hubung). Setelah
          undangan ada di daftar, pakai <strong>Pasang contoh slide</strong> untuk demo isi (termasuk slide
          fitur).
        </p>
        <form onSubmit={onCreate} className="form">
          <label>
            Slug
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="contoh: aji-dan-sari"
              required
              minLength={2}
            />
          </label>
          <label>
            Judul (opsional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pernikahan Aji & Sari"
            />
          </label>
          {createErr && <p className="error">{createErr}</p>}
          <button type="submit" className="btn primary" disabled={creating}>
            {creating ? '…' : 'Simpan'}
          </button>
        </form>
      </section>

      {err && <p className="error">{err}</p>}
      {!list && !err && <p className="muted">Memuat…</p>}
      {list && list.length === 0 && !err && (
        <p className="muted">Belum ada undangan di daftar — isi form di atas.</p>
      )}

      <ul className="inv-list">
        {list?.map((inv) => (
          <li key={inv.id} className="inv-item">
            <div>
              <strong>{inv.title ?? inv.slug}</strong>
              <span className="muted small"> / {inv.slug}</span>
              {inv.is_published ? (
                <span className="badge ok">publik</span>
              ) : (
                <span className="badge">draf</span>
              )}
            </div>
            <div className="inv-actions">
              <Link className="btn small primary" to={`/dashboard/invitations/${inv.id}`}>
                Kelola
              </Link>
              <Link
                className="btn small"
                to={`/preview/${inv.id}`}
                target="_blank"
                rel="noreferrer"
                title="Tampilan seperti tamu. Bisa dipakai saat undangan masih draf."
              >
                Pratinjau
              </Link>
              <button
                type="button"
                className="btn small"
                disabled={exampleBusy === inv.id}
                onClick={() => applyExampleSlides(inv.id)}
                title="Mengganti semua slide dengan contoh demo"
              >
                {exampleBusy === inv.id ? '…' : 'Pasang contoh slide'}
              </button>
              {!inv.is_published && (
                <button
                  type="button"
                  className="btn small"
                  disabled={pubBusy === inv.id}
                  onClick={() => publish(inv.id)}
                >
                  {pubBusy === inv.id ? '…' : 'Terbitkan'}
                </button>
              )}
              <Link
                className="btn small"
                to={`/i/${encodeURIComponent(inv.slug)}`}
                target="_blank"
                rel="noreferrer"
                title="URL publik resmi ke tamu — perlu Terbitkan jika masih draf."
              >
                Lihat (tamu)
              </Link>
              <button
                type="button"
                className="btn small danger"
                disabled={deleteBusy === inv.id}
                title="Hapus undangan ini"
                onClick={() => deleteInvitation(inv.id, inv.title?.trim() || inv.slug)}
              >
                {deleteBusy === inv.id ? '…' : 'Hapus'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">
        <Link to="/">← Beranda</Link>
      </p>
    </div>
  )
}
