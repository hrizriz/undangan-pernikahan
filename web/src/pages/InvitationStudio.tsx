import { type FormEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SlideFlowCanvas } from '../components/SlideFlowCanvas'
import { SlidePayloadEditor } from '../components/SlidePayloadEditor'
import { ThemeIcon } from '../components/ThemeIcon'
import { apiFetch } from '../api'
import { getToken } from '../auth'
import { getExampleSlidesPayload } from '../data/exampleSlides'
import { INVITATION_TEMPLATES, type InvitationTemplateDef } from '../data/invitationTemplates'
import { defaultFlowLayout, FLOW_DEFAULT_X, FLOW_DEFAULT_Y, mergeFlowLayoutFromSettings } from '../lib/flowLayout'
import { defaultPayloadForType, SLIDE_TYPE_OPTIONS } from '../lib/slideTemplates'
import type {
  FlowDraftSlide,
  FlowNodePosition,
  Guest,
  GuestWish,
  InvitationDetail,
  InvitationSettings,
  RSVPEntry,
  Slide,
} from '../types'
import './invitation-studio.css'

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function stripSlideLabel(d: FlowDraftSlide): string {
  const p = d.payload
  let t =
    typeof p.title === 'string'
      ? p.title
      : typeof p.heading === 'string'
        ? p.heading
        : ''
  if (!t.trim() && d.slide_type === 'couple') {
    const g = typeof p.groom_name === 'string' ? p.groom_name : ''
    const b = typeof p.bride_name === 'string' ? p.bride_name : ''
    t = [g, b].filter((x) => x.trim()).join(' & ')
  }
  const s = t.trim()
  if (s) return s.length > 26 ? `${s.slice(0, 24)}…` : s
  return SLIDE_TYPE_OPTIONS.find((o) => o.type === d.slide_type)?.label ?? d.slide_type
}

function newClientKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `k-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeSlidePayload(slideType: string, p: Record<string, unknown>): Record<string, unknown> {
  const out = { ...p }
  if (slideType === 'gallery' && Array.isArray(out.images)) {
    out.images = out.images.filter((x) => typeof x === 'string' && x.trim().length > 0)
  }
  if (slideType === 'countdown' && typeof out.event_at === 'string' && out.event_at.trim() === '') {
    delete out.event_at
  }
  if (slideType === 'gift' && Array.isArray(out.accounts)) {
    out.accounts = out.accounts.filter((a) => {
      if (!a || typeof a !== 'object') return false
      const o = a as Record<string, unknown>
      const bank = typeof o.bank === 'string' ? o.bank.trim() : ''
      const num = typeof o.number === 'string' ? o.number.trim() : ''
      return bank.length > 0 || num.length > 0
    })
  }
  return out
}

function rsvpDisplay(data: unknown): { line: string; rawJson: string | null } {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>
    if ('attending' in o || 'pax' in o || 'message' in o) {
      const att =
        o.attending === true ? 'Hadir' : o.attending === false ? 'Tidak hadir' : '—'
      const pax = typeof o.pax === 'number' ? o.pax : '—'
      const msg = typeof o.message === 'string' && o.message.trim() ? o.message.trim() : ''
      const base = `${att} · ${pax} orang`
      return { line: msg ? `${base} · ${msg}` : base, rawJson: null }
    }
  }
  const rawJson =
    typeof data === 'string'
      ? data
      : JSON.stringify(data, null, 2)
  return { line: '', rawJson }
}

function slidesToDraft(slides: Slide[]): FlowDraftSlide[] {
  return slides.map((s) => ({
    clientKey: s.id,
    slide_type: s.slide_type,
    payload:
      typeof s.payload === 'object' && s.payload !== null && !Array.isArray(s.payload)
        ? (s.payload as Record<string, unknown>)
        : {},
  }))
}

function reorderDrafts(list: FlowDraftSlide[], from: number, to: number): FlowDraftSlide[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const n = [...list]
  const [item] = n.splice(from, 1)
  n.splice(to, 0, item)
  return n
}

/** Snapshot isi slide + posisi kanvas (tanpa clientKey) untuk deteksi belum simpan. */
function serializeSlidesState(drafts: FlowDraftSlide[], positions: FlowNodePosition[]): string {
  return JSON.stringify({
    slides: drafts.map((d) => ({
      t: d.slide_type,
      p: normalizeSlidePayload(d.slide_type, d.payload),
    })),
    pos: positions,
  })
}

export function InvitationStudio() {
  const { id = '' } = useParams<{ id: string }>()
  const token = getToken()
  const [inv, setInv] = useState<InvitationDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'slides' | 'guests' | 'rsvp' | 'wishes' | 'settings'>('slides')
  const [drafts, setDrafts] = useState<FlowDraftSlide[]>([])
  const [flowPositions, setFlowPositions] = useState<FlowNodePosition[]>([])
  const [selectedSlideKey, setSelectedSlideKey] = useState<string | null>(null)
  const [settings, setSettings] = useState<InvitationSettings>({})
  const [guests, setGuests] = useState<Guest[]>([])
  const [rsvp, setRsvp] = useState<RSVPEntry[]>([])
  const [wishes, setWishes] = useState<GuestWish[]>([])
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [headerFile, setHeaderFile] = useState<File | null>(null)
  const [headerUploading, setHeaderUploading] = useState(false)
  const [headerUploadErr, setHeaderUploadErr] = useState<string | null>(null)
  const [bgFile, setBgFile] = useState<File | null>(null)
  const [bgUploading, setBgUploading] = useState(false)
  const [bgUploadErr, setBgUploadErr] = useState<string | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const lastSavedSlidesRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !id) return
    setErr(null)
    const res = await apiFetch(`/api/v1/invitations/${id}`, { token })
    const data = (await res.json()) as InvitationDetail & { error?: string }
    if (!res.ok) {
      setErr(data.error ?? 'gagal memuat')
      return
    }
    const slides = data.slides ?? []
    const s = (data.settings as InvitationSettings) ?? {}
    const draftList = slidesToDraft(slides)
    const positions = mergeFlowLayoutFromSettings(slides.length, s.flow_layout)
    setInv(data)
    setDrafts(draftList)
    setFlowPositions(positions)
    lastSavedSlidesRef.current = serializeSlidesState(draftList, positions)
    setSelectedSlideKey(null)
    setSettings(s)
  }, [token, id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !id || tab !== 'guests') return
    ;(async () => {
      const res = await apiFetch(`/api/v1/invitations/${id}/guests`, { token })
      const data = (await res.json()) as { guests?: Guest[] }
      if (res.ok) setGuests(data.guests ?? [])
    })()
  }, [token, id, tab])

  useEffect(() => {
    if (!token || !id || tab !== 'rsvp') return
    ;(async () => {
      const res = await apiFetch(`/api/v1/invitations/${id}/rsvp`, { token })
      const data = (await res.json()) as { rsvp?: RSVPEntry[] }
      if (res.ok) setRsvp(data.rsvp ?? [])
    })()
  }, [token, id, tab])

  useEffect(() => {
    if (!token || !id || tab !== 'wishes') return
    ;(async () => {
      const res = await apiFetch(`/api/v1/invitations/${id}/wishes`, { token })
      const data = (await res.json()) as { wishes?: GuestWish[] }
      if (res.ok) setWishes(data.wishes ?? [])
    })()
  }, [token, id, tab])

  const slidesDirty = useMemo(() => {
    if (lastSavedSlidesRef.current === null) return false
    return serializeSlidesState(drafts, flowPositions) !== lastSavedSlidesRef.current
  }, [drafts, flowPositions])

  useEffect(() => {
    if (!slidesDirty) return
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [slidesDirty])

  function requestTab(next: typeof tab) {
    if (tab === 'slides' && slidesDirty) {
      const ok = window.confirm(
        'Perubahan slide belum disimpan ke server. Pindah tab sekarang akan membuang perubahan. Lanjut?',
      )
      if (!ok) return
    }
    setTab(next)
  }

  function dashboardClick(e: MouseEvent<HTMLAnchorElement>) {
    if (slidesDirty) {
      const ok = window.confirm(
        'Perubahan slide belum disimpan. Yakin kembali ke dashboard? Perubahan akan hilang.',
      )
      if (!ok) e.preventDefault()
    }
  }

  function updateDraftType(index: number, slideType: string) {
    setDrafts((prev) => {
      const n = [...prev]
      n[index] = {
        ...n[index],
        slide_type: slideType,
        payload: defaultPayloadForType(slideType),
      }
      return n
    })
  }

  function setPayloadAt(index: number, next: Record<string, unknown>) {
    setDrafts((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], payload: next }
      return copy
    })
  }

  const selectedSlideIndex = useMemo(() => {
    if (selectedSlideKey === null) return null
    const i = drafts.findIndex((d) => d.clientKey === selectedSlideKey)
    return i >= 0 ? i : null
  }, [drafts, selectedSlideKey])

  function onFlowReorder(next: FlowDraftSlide[]) {
    setDrafts(next)
  }

  function onFlowPositionsChange(next: FlowNodePosition[]) {
    setFlowPositions(next)
  }

  function resetFlowLayout() {
    setFlowPositions(defaultFlowLayout(drafts.length))
  }

  function moveSlide(index: number, dir: -1 | 1) {
    const to = index + dir
    if (to < 0 || to >= drafts.length) return
    setDrafts((prev) => reorderDrafts(prev, index, to))
    setFlowPositions((prev) => {
      const n = [...prev]
      const [row] = n.splice(index, 1)
      n.splice(to, 0, row)
      return n
    })
  }

  function removeSlide(index: number) {
    const k = drafts[index]?.clientKey
    setDrafts((prev) => prev.filter((_, i) => i !== index))
    setFlowPositions((prev) => prev.filter((_, i) => i !== index))
    if (k && selectedSlideKey === k) setSelectedSlideKey(null)
  }

  function addSlide() {
    const t = 'cover'
    const key = newClientKey()
    setDrafts((prev) => [...prev, { clientKey: key, slide_type: t, payload: defaultPayloadForType(t) }])
    setFlowPositions((prev) => {
      const last = prev[prev.length - 1]
      const x = last ? last.x + FLOW_DEFAULT_X : 0
      return [...prev, { x, y: FLOW_DEFAULT_Y }]
    })
    setSelectedSlideKey(key)
  }

  async function saveSlides() {
    if (!token || !id) return
    setErr(null)
    setSaving(true)
    try {
      const res = await apiFetch(`/api/v1/invitations/${id}/slides`, {
        method: 'PUT',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: drafts.map((d) => ({
            slide_type: d.slide_type,
            payload: normalizeSlidePayload(d.slide_type, d.payload),
          })),
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErr(data.error ?? 'gagal simpan slide')
        return
      }
      const mergedSettings: InvitationSettings = {
        ...settings,
        flow_layout: { nodes: flowPositions },
      }
      const patchRes = await apiFetch(`/api/v1/invitations/${id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: mergedSettings }),
      })
      const patchData = (await patchRes.json()) as { error?: string }
      if (!patchRes.ok) {
        setErr(patchData.error ?? 'slide tersimpan, tetapi layout kanvas gagal disimpan')
        setSettings(mergedSettings)
        await load()
        return
      }
      setSettings(mergedSettings)
      await load()
    } catch {
      setErr('tidak terhubung ke API')
    } finally {
      setSaving(false)
    }
  }

  function loadExample() {
    if (!window.confirm('Mengganti semua slide dengan contoh?')) return
    const ex = getExampleSlidesPayload()
    const next = ex.slides.map((s) => ({
      clientKey: newClientKey(),
      slide_type: s.slide_type,
      payload: s.payload as Record<string, unknown>,
    }))
    setDrafts(next)
    setFlowPositions(defaultFlowLayout(next.length))
    setSelectedSlideKey(next[0]?.clientKey ?? null)
  }

  function applyTemplate(def: InvitationTemplateDef) {
    if (
      !window.confirm(
        `Terapkan template "${def.name}"? Semua slide saat ini akan diganti. Urutan kanvas disusun otomatis (grid horizontal).`,
      )
    ) {
      return
    }
    const next = def.slides.map((s) => ({
      clientKey: newClientKey(),
      slide_type: s.slide_type,
      payload: JSON.parse(JSON.stringify(s.payload)) as Record<string, unknown>,
    }))
    const pos = defaultFlowLayout(next.length)
    setDrafts(next)
    setFlowPositions(pos)
    setSettings((prev) => ({
      ...prev,
      accent_color: def.settingsPatch.accent_color,
      font_family: def.settingsPatch.font_family,
      meta_description: def.settingsPatch.meta_description,
      theme: def.settingsPatch.theme,
      flow_layout: { nodes: pos },
    }))
    setSelectedSlideKey(next[0]?.clientKey ?? null)
    setTemplateModalOpen(false)
  }

  async function saveSettings() {
    if (!token || !id) return
    setSaving(true)
    setErr(null)
    try {
      const payload: InvitationSettings = {
        ...settings,
        flow_layout: { nodes: flowPositions },
      }
      const res = await apiFetch(`/api/v1/invitations/${id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErr(data.error ?? 'gagal simpan pengaturan')
        return
      }
      await load()
    } catch {
      setErr('tidak terhubung ke API')
    } finally {
      setSaving(false)
    }
  }

  async function uploadHeaderImage() {
    if (!token || !id) return
    if (!headerFile) {
      setHeaderUploadErr('Pilih file gambar dulu.')
      return
    }
    setHeaderUploadErr(null)
    setHeaderUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', headerFile)
      const res = await apiFetch('/api/v1/assets/header-image', { method: 'POST', token, body: fd })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        setHeaderUploadErr(j?.error ?? 'gagal upload')
        return
      }
      const j = (await res.json()) as { url?: string }
      const url = typeof j.url === 'string' ? j.url : ''
      if (!url) {
        setHeaderUploadErr('gagal upload')
        return
      }
      // Simpan langsung ke settings undangan agar preview/publik langsung berubah.
      const nextSettings: InvitationSettings = {
        ...settings,
        header_image_url: url,
        flow_layout: { nodes: flowPositions },
      }
      const patch = await apiFetch(`/api/v1/invitations/${id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: nextSettings }),
      })
      if (!patch.ok) {
        const pj = (await patch.json().catch(() => null)) as { error?: string } | null
        setHeaderUploadErr(pj?.error ?? 'gagal simpan pengaturan')
        return
      }
      setSettings((s) => ({ ...s, header_image_url: url }))
      setHeaderFile(null)
      await load()
    } catch {
      setHeaderUploadErr('tidak terhubung ke API')
    } finally {
      setHeaderUploading(false)
    }
  }

  async function uploadBackgroundImage() {
    if (!token || !id) return
    if (!bgFile) {
      setBgUploadErr('Pilih file gambar dulu.')
      return
    }
    setBgUploadErr(null)
    setBgUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', bgFile)
      const res = await apiFetch('/api/v1/assets/background-image', { method: 'POST', token, body: fd })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        setBgUploadErr(j?.error ?? 'gagal upload')
        return
      }
      const j = (await res.json()) as { url?: string }
      const url = typeof j.url === 'string' ? j.url : ''
      if (!url) {
        setBgUploadErr('gagal upload')
        return
      }
      const nextSettings: InvitationSettings = {
        ...settings,
        background_image_url: url,
        flow_layout: { nodes: flowPositions },
      }
      const patch = await apiFetch(`/api/v1/invitations/${id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: nextSettings }),
      })
      if (!patch.ok) {
        const pj = (await patch.json().catch(() => null)) as { error?: string } | null
        setBgUploadErr(pj?.error ?? 'gagal simpan pengaturan')
        return
      }
      setSettings((s) => ({ ...s, background_image_url: url }))
      setBgFile(null)
      await load()
    } catch {
      setBgUploadErr('tidak terhubung ke API')
    } finally {
      setBgUploading(false)
    }
  }

  async function togglePublish(published: boolean) {
    if (!token || !id) return
    setSaving(true)
    setErr(null)
    try {
      const res = await apiFetch(`/api/v1/invitations/${id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: published }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setErr(data.error ?? 'gagal')
        return
      }
      await load()
    } catch {
      setErr('tidak terhubung ke API')
    } finally {
      setSaving(false)
    }
  }

  async function addGuest(e: FormEvent) {
    e.preventDefault()
    if (!token || !id || !guestName.trim()) return
    setErr(null)
    const res = await apiFetch(`/api/v1/invitations/${id}/guests`, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: guestName.trim(),
        phone: guestPhone.trim() || undefined,
      }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setErr(data.error ?? 'gagal tambah tamu')
      return
    }
    setGuestName('')
    setGuestPhone('')
    const r = await apiFetch(`/api/v1/invitations/${id}/guests`, { token })
    const j = (await r.json()) as { guests?: Guest[] }
    if (r.ok) setGuests(j.guests ?? [])
  }

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/i/` : '/i/'

  if (!inv && !err) {
    return (
      <div className="page studio studio-full">
        <p className="muted">Memuat…</p>
      </div>
    )
  }

  return (
    <div className="page studio studio-full">
      <header className="studio-head">
        <div>
          <Link to="/dashboard" className="studio-back" onClick={dashboardClick}>
            ← Dashboard
          </Link>
          <h1>{inv?.title ?? inv?.slug ?? 'Undangan'}</h1>
          <p className="muted small">
            Slug: <code>{inv?.slug}</code> ·{' '}
            <Link to={`/preview/${id}`} target="_blank" rel="noreferrer">
              Pratinjau
            </Link>
            {' · '}
            <a href={`${baseUrl}${encodeURIComponent(inv?.slug ?? '')}`} target="_blank" rel="noreferrer">
              Buka tamu (publik)
            </a>
          </p>
        </div>
        <div className="studio-head-actions">
          {inv?.is_published ? (
            <span className="badge ok">Publik</span>
          ) : (
            <span className="badge">Draf</span>
          )}
          {!inv?.is_published ? (
            <button type="button" className="btn primary small" disabled={saving} onClick={() => togglePublish(true)}>
              Terbitkan
            </button>
          ) : (
            <button type="button" className="btn ghost small" disabled={saving} onClick={() => togglePublish(false)}>
              Jadikan draf
            </button>
          )}
        </div>
      </header>

      {err && <p className="error">{err}</p>}

      <nav className="studio-tabs">
        {(
          [
            ['slides', 'Slide'],
            ['guests', 'Tamu'],
            ['rsvp', 'RSVP'],
            ['wishes', 'Ucapan'],
            ['settings', 'Tampilan & musik'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={tab === k ? 'active' : ''}
            onClick={() => requestTab(k)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'slides' && (
        <section className="studio-panel studio-slide-workspace">
          <div className="studio-toolbar">
            {slidesDirty && (
              <span className="studio-unsaved-badge" title="Belum disimpan ke server">
                Belum disimpan
              </span>
            )}
            <button type="button" className="btn small" onClick={addSlide}>
              + Slide
            </button>
            <button type="button" className="btn small" onClick={loadExample}>
              Pasang contoh slide
            </button>
            <button type="button" className="btn small" onClick={() => setTemplateModalOpen(true)}>
              Template undangan
            </button>
            <button type="button" className="btn primary small" disabled={saving} onClick={() => saveSlides()}>
              {saving ? '…' : 'Simpan slide'}
            </button>
            <button
              type="button"
              className="btn small"
              disabled={drafts.length === 0}
              title="Reset posisi node ke grid rata kiri"
              onClick={resetFlowLayout}
            >
              Rapikan ke grid
            </button>
          </div>
          <p className="muted small studio-flow-hint">
            <strong>Template undangan</strong> mengisi slide + warna + font + tema halaman tamu, dan menyusun node
            kanvas dalam satu baris (tidak perlu rapikan manual). Model alur seperti <strong>Apache NiFi</strong>: tiap
            slide = proses dalam pipeline. <strong>Seret node</strong> bila ingin mengubah urutan atau posisi. Klik
            node → edit di panel kanan, lalu <strong>Simpan ke server</strong> atau <strong>Simpan slide</strong>.
            Pindah tab tanpa simpan akan membuang perubahan.
          </p>
          <div className="studio-flow-shell">
            <div className="studio-flow-main">
              {drafts.length > 0 ? (
                <>
                  <div className="studio-canvas-area">
                    <SlideFlowCanvas
                      drafts={drafts}
                      positions={flowPositions}
                      selectedKey={selectedSlideKey}
                      onSelectKey={setSelectedSlideKey}
                      onReorder={onFlowReorder}
                      onPositionsChange={onFlowPositionsChange}
                      theme={settings.theme}
                    />
                  </div>
                  <div className="studio-flow-strip" aria-label="Ringkasan slide tersimpan">
                    {drafts.map((d, i) => (
                      <button
                        key={d.clientKey}
                        type="button"
                        className={selectedSlideKey === d.clientKey ? 'is-active' : ''}
                        onClick={() => setSelectedSlideKey(d.clientKey)}
                      >
                        {i + 1}. {stripSlideLabel(d)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="studio-flow-empty muted">
                  Belum ada slide. Klik <strong>+ Slide</strong> atau <strong>Pasang contoh slide</strong>.
                </div>
              )}
            </div>
            <aside className="studio-flow-inspector card">
              {selectedSlideIndex !== null ? (
                <>
                  <div className="studio-flow-inspector-head">
                    <span className="slide-index">#{selectedSlideIndex + 1}</span>
                    <select
                      value={drafts[selectedSlideIndex]!.slide_type}
                      onChange={(e) => updateDraftType(selectedSlideIndex, e.target.value)}
                    >
                      {SLIDE_TYPE_OPTIONS.map((o) => (
                        <option key={o.type} value={o.type}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn ghost small" onClick={() => moveSlide(selectedSlideIndex, -1)}>
                      ↑
                    </button>
                    <button type="button" className="btn ghost small" onClick={() => moveSlide(selectedSlideIndex, 1)}>
                      ↓
                    </button>
                    <button type="button" className="btn ghost small" onClick={() => removeSlide(selectedSlideIndex)}>
                      Hapus
                    </button>
                  </div>
                  <SlidePayloadEditor
                    slideType={drafts[selectedSlideIndex]!.slide_type}
                    payload={drafts[selectedSlideIndex]!.payload}
                    editorVersion={`${drafts[selectedSlideIndex]!.clientKey}-${drafts[selectedSlideIndex]!.slide_type}`}
                    onPayloadChange={(next) => setPayloadAt(selectedSlideIndex, next)}
                  />
                  <div className="studio-slide-save-row">
                    <button
                      type="button"
                      className="btn primary small"
                      disabled={saving || !slidesDirty}
                      onClick={() => saveSlides()}
                    >
                      {saving ? 'Menyimpan…' : 'Simpan ke server'}
                    </button>
                    {!slidesDirty ? (
                      <span className="muted small">Semua perubahan tersimpan</span>
                    ) : (
                      <span className="muted small">Simpan sebelum pindah tab</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="muted small">
                  Pilih sebuah node di kanvas untuk mengisi judul, teks, dan pengaturan slide.
                </p>
              )}
            </aside>
          </div>
        </section>
      )}

      {tab === 'guests' && (
        <section className="studio-panel studio-tab-card card">
          <h2 className="h2">Tamu undangan</h2>
          <form onSubmit={addGuest} className="form">
            <label>
              Nama
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
            </label>
            <label>
              Telepon (opsional)
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </label>
            <button type="submit" className="btn primary" disabled={saving}>
              Tambah tamu
            </button>
          </form>
          <ul className="guest-list">
            {guests.map((g) => (
              <li key={g.id}>
                <strong>{g.name}</strong>
                {g.phone && <span className="muted small"> · {g.phone}</span>}
                <div className="muted small token-wrap">
                  Token: <code>{g.token}</code>
                </div>
                <div className="muted small">
                  Link:{' '}
                  <a
                    href={`${baseUrl}${encodeURIComponent(inv?.slug ?? '')}?token=${encodeURIComponent(g.token)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    buka undangan
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'rsvp' && (
        <section className="studio-panel studio-tab-card card">
          <h2 className="h2">Konfirmasi kehadiran</h2>
          <ul className="rsvp-list">
            {rsvp.map((r) => {
              const { line, rawJson } = rsvpDisplay(r.data)
              return (
                <li key={r.id}>
                  <time>{new Date(r.created_at).toLocaleString('id-ID')}</time>
                  {r.guest_name && <strong> {r.guest_name}</strong>}
                  {line && <p className="rsvp-line">{line}</p>}
                  {rawJson !== null && <pre className="rsvp-data">{rawJson}</pre>}
                </li>
              )
            })}
          </ul>
          {rsvp.length === 0 && <p className="muted">Belum ada RSVP.</p>}
        </section>
      )}

      {tab === 'wishes' && (
        <section className="studio-panel studio-tab-card card">
          <h2 className="h2">Ucapan tamu</h2>
          <p className="muted small">
            Ucapan dari halaman publik (boleh tanpa token; dengan token tamu terdaftar tercatat sebagai tamu).
          </p>
          <ul className="guest-list">
            {wishes.map((w) => (
              <li key={w.id}>
                <strong>{w.author_name}</strong>
                {w.guest_id ? <span className="muted small"> · tamu terdaftar</span> : null}
                <time className="muted small" style={{ display: 'block' }}>
                  {new Date(w.created_at).toLocaleString('id-ID')}
                </time>
                <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap' }}>{w.message}</p>
              </li>
            ))}
          </ul>
          {wishes.length === 0 && <p className="muted">Belum ada ucapan.</p>}
        </section>
      )}

      {tab === 'settings' && (
        <section className="studio-panel studio-tab-card card">
          <h2 className="h2">Tampilan & musik</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveSettings()
            }}
            className="form"
          >
            <label>
              Warna aksen (hex)
              <input
                value={settings.accent_color ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
                placeholder="#c76b8f"
              />
            </label>
            <label>
              Font isi (CSS, opsional)
              <input
                value={settings.font_family ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, font_family: e.target.value }))}
                placeholder="Kosong = font bawaan tema (beda per tema)"
              />
            </label>
            <p className="muted small">
              Jika dikosongkan, halaman tamu memakai pasangan font khusus per tema (judul & isi). Isi field ini hanya
              jika ingin mengganti font paragraf secara manual.
            </p>
            <label>
              Tema halaman tamu (latar & nuansa)
              <select
                value={settings.theme ?? 'simple'}
                onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))}
              >
                {INVITATION_TEMPLATES.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Foto bulat di atas judul (opsional, ganti ikon tema)
              <input type="file" accept="image/*" onChange={(e) => setHeaderFile(e.target.files?.[0] ?? null)} />
              <div className="row" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={headerUploading || !headerFile}
                  onClick={() => void uploadHeaderImage()}
                >
                  {headerUploading ? 'Mengunggah…' : 'Upload logo'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={headerUploading || !settings.header_image_url}
                  onClick={() => setSettings((s) => ({ ...s, header_image_url: undefined }))}
                >
                  Hapus logo
                </button>
                {headerFile && <span className="muted small">{headerFile.name}</span>}
              </div>
              {headerUploadErr && <p className="muted small">Gagal upload: {headerUploadErr}</p>}
              {settings.header_image_url && (
                <div style={{ marginTop: '0.65rem' }}>
                  <img
                    src={settings.header_image_url}
                    alt="Preview logo"
                    style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
            </label>
            <label>
              Background (foto) halaman tamu
              <input type="file" accept="image/*" onChange={(e) => setBgFile(e.target.files?.[0] ?? null)} />
              <div className="row" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={bgUploading || !bgFile}
                  onClick={() => void uploadBackgroundImage()}
                >
                  {bgUploading ? 'Mengunggah…' : 'Upload background'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={bgUploading || !settings.background_image_url}
                  onClick={() => setSettings((s) => ({ ...s, background_image_url: undefined }))}
                >
                  Hapus background
                </button>
                {bgFile && <span className="muted small">{bgFile.name}</span>}
              </div>
              {bgUploadErr && <p className="muted small">Gagal upload: {bgUploadErr}</p>}
              {settings.background_image_url && (
                <div style={{ marginTop: '0.65rem' }}>
                  <img
                    src={settings.background_image_url}
                    alt="Preview background"
                    style={{ width: '100%', maxWidth: 360, borderRadius: 12, objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
              <p className="muted small" style={{ marginTop: '0.55rem' }}>
                Tips: pakai gambar portrait / blur ringan. Sistem akan menambahkan overlay warna-warni agar teks tetap terbaca.
              </p>
            </label>
            <label>
              URL musik latar (mp3, opsional)
              <input
                value={settings.music_url ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, music_url: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label>
              Waktu acara (untuk countdown bila slide tidak punya waktu sendiri)
              <input
                type="datetime-local"
                value={settings.event_at ? isoToDatetimeLocal(settings.event_at) : ''}
                onChange={(e) => {
                  const v = e.target.value
                  setSettings((s) => ({
                    ...s,
                    event_at: v ? new Date(v).toISOString() : undefined,
                  }))
                }}
              />
            </label>
            <label>
              Deskripsi singkat (SEO / pratinjau tautan)
              <input
                value={settings.meta_description ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, meta_description: e.target.value }))}
                placeholder="Undangan pernikahan ..."
              />
            </label>
            <label>
              URL gambar pratinjau (og:image, opsional)
              <input
                value={settings.og_image_url ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, og_image_url: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label className="row-check">
              <input
                type="checkbox"
                checked={settings.show_slide_type_labels === true}
                onChange={(e) => setSettings((s) => ({ ...s, show_slide_type_labels: e.target.checked }))}
              />
              Tampilkan label tipe slide di pojok (debug)
            </label>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? '…' : 'Simpan pengaturan'}
            </button>
          </form>
        </section>
      )}

      {templateModalOpen && (
        <div
          className="template-modal-backdrop"
          role="presentation"
          onClick={() => setTemplateModalOpen(false)}
        >
          <div
            className="template-modal card"
            role="dialog"
            aria-labelledby="template-modal-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="template-modal-head">
              <h2 id="template-modal-title" className="h2">
                Template undangan
              </h2>
              <button type="button" className="btn ghost small" onClick={() => setTemplateModalOpen(false)}>
                Tutup
              </button>
            </div>
            <p className="muted small template-modal-lead">
              Slide, warna, font, dan tema halaman tamu terisi otomatis. Node di kanvas disusun satu baris — bisa tetap
              diedit. Jangan lupa <strong>Simpan slide</strong> setelah memilih.
            </p>
            <ul className="template-grid">
              {INVITATION_TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button type="button" className="template-card" onClick={() => applyTemplate(t)}>
                    <span
                      className="template-card__icon-wrap"
                      style={{ color: t.settingsPatch.accent_color ?? '#c76b8f' }}
                    >
                      <ThemeIcon theme={t.id} size={44} decorative />
                    </span>
                    <span
                      className="template-card__swatch"
                      style={{ background: t.settingsPatch.accent_color }}
                      aria-hidden
                    />
                    <span className="template-card__name">{t.name}</span>
                    <span className="template-card__desc">{t.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
