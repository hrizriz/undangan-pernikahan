import { useEffect, useState } from 'react'
import { HdPhotoUrlField } from './HdPhotoUrlField'

type Props = {
  slideType: string
  payload: Record<string, unknown>
  onPayloadChange: (next: Record<string, unknown>) => void
  /** Ubah saat ganti slide/tipe agar field daftar fitur di-reset dari payload. */
  editorVersion: string
}

function str(p: Record<string, unknown>, key: string): string {
  const v = p[key]
  return typeof v === 'string' ? v : ''
}

function num(p: Record<string, unknown>, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback
}

function bool(p: Record<string, unknown>, key: string): boolean {
  return p[key] === true
}

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Editor galeri: pertahankan baris kosong agar "+ Tambah foto" bisa menampilkan input baru. */
function parseGalleryEditorImages(p: Record<string, unknown>): string[] {
  const raw = p.images
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string')
}

function parseAgendaItems(p: Record<string, unknown>): { time: string; label: string; detail: string }[] {
  const raw = p.items
  if (!Array.isArray(raw)) return []
  return raw.map((it) => {
    if (it && typeof it === 'object' && !Array.isArray(it)) {
      const o = it as Record<string, unknown>
      return {
        time: typeof o.time === 'string' ? o.time : '',
        label: typeof o.label === 'string' ? o.label : '',
        detail: typeof o.detail === 'string' ? o.detail : '',
      }
    }
    return { time: '', label: String(it ?? ''), detail: '' }
  })
}

function parseGiftAccounts(p: Record<string, unknown>): { bank: string; holder: string; number: string; note: string }[] {
  const raw = p.accounts
  if (!Array.isArray(raw)) return []
  return raw.map((it) => {
    if (it && typeof it === 'object' && !Array.isArray(it)) {
      const o = it as Record<string, unknown>
      return {
        bank: typeof o.bank === 'string' ? o.bank : '',
        holder: typeof o.holder === 'string' ? o.holder : '',
        number: typeof o.number === 'string' ? o.number : '',
        note: typeof o.note === 'string' ? o.note : '',
      }
    }
    return { bank: '', holder: '', number: '', note: '' }
  })
}

function parseFeatureItems(p: Record<string, unknown>): string[] {
  const raw = p.items
  if (!Array.isArray(raw)) return []
  return raw.map((it) => {
    if (typeof it === 'string') return it
    if (it && typeof it === 'object' && 'text' in it) {
      const t = (it as { text?: unknown }).text
      return typeof t === 'string' ? t : String(t ?? '')
    }
    return String(it)
  })
}

function itemsToPayloadLines(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function FeaturesFields({
  payload,
  onPayloadChange,
  editorVersion,
}: {
  payload: Record<string, unknown>
  onPayloadChange: (next: Record<string, unknown>) => void
  editorVersion: string
}) {
  const [itemsText, setItemsText] = useState(() => parseFeatureItems(payload).join('\n'))

  useEffect(() => {
    setItemsText(parseFeatureItems(payload).join('\n'))
  }, [editorVersion])

  const patch = (partial: Record<string, unknown>) => {
    onPayloadChange({ ...payload, ...partial })
  }

  return (
    <div className="slide-fields">
      <label>
        Judul blok
        <input value={str(payload, 'heading') || str(payload, 'title')} onChange={(e) => patch({ heading: e.target.value })} />
      </label>
      <label>
        Subjudul (opsional)
        <input value={str(payload, 'subtitle')} onChange={(e) => patch({ subtitle: e.target.value })} />
      </label>
      <label className="row-check">
        <input
          type="checkbox"
          checked={bool(payload, 'lead_first')}
          onChange={(e) => patch({ lead_first: e.target.checked })}
        />
        Tandai baris pertama sebagai penekanan
      </label>
      <label>
        Jumlah item tampil awal sebelum &quot;lihat lebih&quot;
        <input
          type="number"
          min={0}
          value={num(payload, 'initial_visible', 8)}
          onChange={(e) => patch({ initial_visible: Number(e.target.value) })}
        />
      </label>
      <label>
        Daftar poin (satu baris = satu item)
        <textarea
          rows={8}
          value={itemsText}
          onChange={(e) => {
            const v = e.target.value
            setItemsText(v)
            patch({ items: itemsToPayloadLines(v) })
          }}
        />
      </label>
    </div>
  )
}

export function SlidePayloadEditor({ slideType, payload, onPayloadChange, editorVersion }: Props) {
  const patch = (partial: Record<string, unknown>) => {
    onPayloadChange({ ...payload, ...partial })
  }

  switch (slideType) {
    case 'cover':
      return (
        <div className="slide-fields">
          <label>
            Judul
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            Subjudul
            <input value={str(payload, 'subtitle')} onChange={(e) => patch({ subtitle: e.target.value })} />
          </label>
          <label>
            Teks / detail acara
            <textarea rows={3} value={str(payload, 'body')} onChange={(e) => patch({ body: e.target.value })} />
          </label>
          <HdPhotoUrlField
            legend="Foto HD (cover)"
            inputLabel="URL gambar cover"
            value={str(payload, 'image_url') || str(payload, 'image')}
            onChange={(v) => patch({ image_url: v, image: v })}
          />
        </div>
      )

    case 'couple':
      return (
        <div className="slide-fields">
          <label>
            Judul blok
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            Nama mempelai pria
            <input value={str(payload, 'groom_name')} onChange={(e) => patch({ groom_name: e.target.value })} />
          </label>
          <label>
            Nama mempelai wanita
            <input value={str(payload, 'bride_name')} onChange={(e) => patch({ bride_name: e.target.value })} />
          </label>
          <label>
            Orang tua pria
            <input value={str(payload, 'groom_parents')} onChange={(e) => patch({ groom_parents: e.target.value })} />
          </label>
          <label>
            Orang tua wanita
            <input value={str(payload, 'bride_parents')} onChange={(e) => patch({ bride_parents: e.target.value })} />
          </label>
          <HdPhotoUrlField
            legend="Foto HD — mempelai pria"
            inputLabel="URL foto pria"
            value={str(payload, 'groom_photo')}
            onChange={(v) => patch({ groom_photo: v })}
          />
          <HdPhotoUrlField
            legend="Foto HD — mempelai wanita"
            inputLabel="URL foto wanita"
            value={str(payload, 'bride_photo')}
            onChange={(v) => patch({ bride_photo: v })}
          />
        </div>
      )

    case 'quote':
      return (
        <div className="slide-fields">
          <label>
            Kutipan
            <textarea rows={4} value={str(payload, 'text')} onChange={(e) => patch({ text: e.target.value })} />
          </label>
          <label>
            Sumber / penulis (opsional)
            <input value={str(payload, 'author')} onChange={(e) => patch({ author: e.target.value })} />
          </label>
        </div>
      )

    case 'countdown':
      return (
        <div className="slide-fields">
          <label>
            Judul slide
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            Waktu acara
            <input
              type="datetime-local"
              value={str(payload, 'event_at') ? isoToDatetimeLocal(str(payload, 'event_at')) : ''}
              onChange={(e) => {
                const v = e.target.value
                patch({ event_at: v ? new Date(v).toISOString() : '' })
              }}
            />
          </label>
          <p className="muted small">Jika kosong, halaman tamu memakai waktu di tab Tampilan & musik.</p>
        </div>
      )

    case 'event':
      return (
        <div className="slide-fields">
          <label>
            Judul
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            Tanggal (teks bebas)
            <input value={str(payload, 'date_label')} onChange={(e) => patch({ date_label: e.target.value })} />
          </label>
          <label>
            Waktu
            <input value={str(payload, 'time_label')} onChange={(e) => patch({ time_label: e.target.value })} />
          </label>
          <label>
            Venue / tempat
            <input value={str(payload, 'venue')} onChange={(e) => patch({ venue: e.target.value })} />
          </label>
          <label>
            Alamat lengkap
            <textarea rows={2} value={str(payload, 'address')} onChange={(e) => patch({ address: e.target.value })} />
          </label>
          <label>
            Dress code
            <input value={str(payload, 'dress_code')} onChange={(e) => patch({ dress_code: e.target.value })} />
          </label>
          <label>
            Tautan Google Maps (buka di tab baru)
            <input
              value={str(payload, 'maps_url')}
              onChange={(e) => patch({ maps_url: e.target.value })}
              placeholder="https://maps.google.com/..."
            />
          </label>
        </div>
      )

    case 'gallery': {
      const urls = parseGalleryEditorImages(payload)
      return (
        <div className="slide-fields">
          <label>
            Judul galeri
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <fieldset className="hd-photo-field hd-photo-field--gallery">
            <legend>Galeri foto HD</legend>
            <p className="muted small hd-photo-field__hint">
              Tiap baris = satu foto. Gunakan URL file gambar resolusi tinggi (≥1200px lebar disarankan). Tambah/hapus
              baris sesuai kebutuhan.
            </p>
          </fieldset>
          <ul className="gallery-url-list">
            {urls.map((u, i) => (
              <li key={i}>
                <input
                  value={u}
                  onChange={(e) => {
                    const next = [...urls]
                    next[i] = e.target.value
                    patch({ images: next })
                  }}
                />
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => patch({ images: urls.filter((_, j) => j !== i) })}
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn small"
            onClick={() => patch({ images: [...urls, ''] })}
          >
            + Tambah foto
          </button>
        </div>
      )
    }

    case 'map':
      return (
        <div className="slide-fields">
          <label>
            Judul lokasi
            <input value={str(payload, 'label')} onChange={(e) => patch({ label: e.target.value })} />
          </label>
          <label>
            URL embed Google Maps
            <textarea
              rows={3}
              value={str(payload, 'embed_url')}
              onChange={(e) => patch({ embed_url: e.target.value })}
              placeholder="https://www.google.com/maps/embed?..."
            />
          </label>
        </div>
      )

    case 'video':
      return (
        <div className="slide-fields">
          <label>
            Judul
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            URL YouTube (embed atau tautan watch)
            <input
              value={str(payload, 'embed_url')}
              onChange={(e) => patch({ embed_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </label>
        </div>
      )

    case 'agenda': {
      const rows = parseAgendaItems(payload)
      return (
        <div className="slide-fields">
          <label>
            Judul
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <p className="muted small">Susunan acara (waktu, nama acara, keterangan)</p>
          <ul className="gallery-url-list">
            {rows.map((row, i) => (
              <li key={i} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    style={{ maxWidth: '5rem' }}
                    placeholder="Waktu"
                    value={row.time}
                    onChange={(e) => {
                      const next = [...rows]
                      next[i] = { ...next[i], time: e.target.value }
                      patch({ items: next })
                    }}
                  />
                  <input
                    style={{ flex: 1, minWidth: '8rem' }}
                    placeholder="Nama acara"
                    value={row.label}
                    onChange={(e) => {
                      const next = [...rows]
                      next[i] = { ...next[i], label: e.target.value }
                      patch({ items: next })
                    }}
                  />
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => patch({ items: rows.filter((_, j) => j !== i) })}
                  >
                    Hapus
                  </button>
                </div>
                <input
                  placeholder="Keterangan (opsional)"
                  value={row.detail}
                  onChange={(e) => {
                    const next = [...rows]
                    next[i] = { ...next[i], detail: e.target.value }
                    patch({ items: next })
                  }}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn small"
            onClick={() => patch({ items: [...rows, { time: '', label: '', detail: '' }] })}
          >
            + Baris acara
          </button>
        </div>
      )
    }

    case 'gift': {
      const acc = parseGiftAccounts(payload)
      return (
        <div className="slide-fields">
          <label>
            Judul
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            Pengantar
            <textarea rows={3} value={str(payload, 'intro')} onChange={(e) => patch({ intro: e.target.value })} />
          </label>
          <p className="muted small">Rekening / e-wallet</p>
          <ul className="gallery-url-list">
            {acc.map((a, i) => (
              <li key={i} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}>
                <input
                  placeholder="Bank / e-wallet"
                  value={a.bank}
                  onChange={(e) => {
                    const next = [...acc]
                    next[i] = { ...next[i], bank: e.target.value }
                    patch({ accounts: next })
                  }}
                />
                <input
                  placeholder="Atas nama"
                  value={a.holder}
                  onChange={(e) => {
                    const next = [...acc]
                    next[i] = { ...next[i], holder: e.target.value }
                    patch({ accounts: next })
                  }}
                />
                <input
                  placeholder="Nomor rekening / HP"
                  value={a.number}
                  onChange={(e) => {
                    const next = [...acc]
                    next[i] = { ...next[i], number: e.target.value }
                    patch({ accounts: next })
                  }}
                />
                <input
                  placeholder="Catatan (opsional)"
                  value={a.note}
                  onChange={(e) => {
                    const next = [...acc]
                    next[i] = { ...next[i], note: e.target.value }
                    patch({ accounts: next })
                  }}
                />
                <button type="button" className="btn ghost small" onClick={() => patch({ accounts: acc.filter((_, j) => j !== i) })}>
                  Hapus rekening
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn small"
            onClick={() => patch({ accounts: [...acc, { bank: '', holder: '', number: '', note: '' }] })}
          >
            + Rekening
          </button>
        </div>
      )
    }

    case 'guestbook':
      return (
        <div className="slide-fields">
          <label>
            Judul
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            Teks pengantar
            <textarea rows={5} value={str(payload, 'body')} onChange={(e) => patch({ body: e.target.value })} />
          </label>
          <p className="muted small">Form ucapan tamu tampil di bagian bawah halaman undangan.</p>
        </div>
      )

    case 'features':
      return (
        <FeaturesFields
          payload={payload}
          onPayloadChange={onPayloadChange}
          editorVersion={editorVersion}
        />
      )

    case 'closing':
      return (
        <div className="slide-fields">
          <label>
            Judul
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            Ucapan
            <textarea rows={4} value={str(payload, 'body')} onChange={(e) => patch({ body: e.target.value })} />
          </label>
        </div>
      )

    default:
      return (
        <div className="slide-fields">
          <p className="muted small">Tipe &quot;{slideType}&quot;: judul dan teks umum.</p>
          <label>
            Judul
            <input value={str(payload, 'title')} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label>
            Subjudul
            <input value={str(payload, 'subtitle')} onChange={(e) => patch({ subtitle: e.target.value })} />
          </label>
          <label>
            Teks
            <textarea rows={3} value={str(payload, 'body')} onChange={(e) => patch({ body: e.target.value })} />
          </label>
        </div>
      )
  }
}
