import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api'
import { getToken } from '../auth'
import { ThemeIcon } from '../components/ThemeIcon'
import { sanitizeTheme } from '../data/invitationTemplates'
import { getThemeTypography } from '../data/themeTypography'
import { buildEventICS, toYouTubeEmbedUrl } from '../lib/weddingInvite'
import type { GuestWish, InvitationSettings, PublicInvitation, Slide } from '../types'
import './PublicInvite.css'

/** Ukuran responsif untuk browser agar memilih resolusi gambar HD jika `srcSet` tersedia nanti. */
const INVITE_IMG_SIZES = '(max-width: 430px) 100vw, min(28rem, 100vw)'

/** Ikon tema atau foto bulat mempelai (`settings.header_image_url`). */
function StoryTopBrand({ theme, headerImageUrl }: { theme: string; headerImageUrl?: string | null }) {
  const [imgErr, setImgErr] = useState(false)
  const url = headerImageUrl?.trim() ?? ''
  const okUrl = url.length > 0 && /^https?:\/\//i.test(url) && !imgErr

  useEffect(() => {
    setImgErr(false)
  }, [url])

  if (okUrl) {
    return (
      <div className="story-top__avatar-wrap">
        <img
          className="story-top__avatar"
          src={url}
          alt="Foto mempelai"
          decoding="async"
          loading="lazy"
          sizes="96px"
          onError={() => setImgErr(true)}
        />
      </div>
    )
  }
  return <ThemeIcon theme={theme} size={48} className="story-top__theme-icon" />
}

function CheckIcon() {
  return (
    <span className="slide-features__icon" aria-hidden>
      <svg viewBox="0 0 22 22" width="20" height="20">
        <circle cx="11" cy="11" r="11" fill="#22c55e" />
        <path
          d="M6 11.2l3 2.8L16 7"
          stroke="#fff"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function parseFeatureItems(p: Record<string, unknown>): { text: string; lead: boolean }[] {
  const raw = p.items
  const leadFirst = p.lead_first === true
  if (!Array.isArray(raw)) return []
  return raw.map((it, i) => {
    if (typeof it === 'string') {
      return { text: it, lead: leadFirst && i === 0 }
    }
    if (it && typeof it === 'object' && 'text' in it) {
      const o = it as { text?: unknown; lead?: boolean }
      const text = typeof o.text === 'string' ? o.text : String(o.text ?? '')
      return { text, lead: o.lead === true }
    }
    return { text: String(it), lead: false }
  })
}

function SlideFeatures({ slide }: { slide: Slide }) {
  const p = slide.payload
  const heading =
    typeof p.heading === 'string'
      ? p.heading
      : typeof p.title === 'string'
        ? p.title
        : undefined
  const subtitle = typeof p.subtitle === 'string' ? p.subtitle : undefined
  const items = parseFeatureItems(p)
  const initialN = typeof p.initial_visible === 'number' ? Math.max(0, p.initial_visible) : 8
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return (
      <article className="slide-inner slide-features slide-features--empty">
        <p className="muted">Tambahkan array <code>items</code> di payload slide bertipe <code>features</code>.</p>
        <span className="slide-type">{slide.slide_type}</span>
      </article>
    )
  }

  const visible =
    initialN === 0
      ? items
      : expanded
        ? items
        : items.slice(0, Math.min(initialN, items.length))
  const hasMore = initialN > 0 && items.length > initialN

  return (
    <article className="slide-inner slide-features">
      {heading && <h2 className="slide-features__heading">{heading}</h2>}
      {subtitle && <p className="slide-features__subtitle">{subtitle}</p>}
      <ul className="slide-features__list">
        {visible.map((row, i) => (
          <li
            key={`${row.text}-${i}`}
            className={`slide-features__item${row.lead ? ' slide-features__item--lead' : ''}`}
          >
            <CheckIcon />
            <span>{row.text}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="slide-features__toggle"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Tampilkan lebih sedikit' : 'Tampilkan lebih banyak'}
        </button>
      )}
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function SlideQuote({ slide }: { slide: Slide }) {
  const p = slide.payload
  const text = typeof p.text === 'string' ? p.text : ''
  const author = typeof p.author === 'string' ? p.author : undefined
  return (
    <article className="slide-inner slide-quote">
      <blockquote className="slide-quote__text">{text || '—'}</blockquote>
      {author && <cite className="slide-quote__author">— {author}</cite>}
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function parseEventAt(p: Record<string, unknown>, settings?: InvitationSettings): Date | null {
  const raw =
    typeof p.event_at === 'string'
      ? p.event_at
      : settings?.event_at
        ? settings.event_at
        : undefined
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function SlideCountdown({ slide, settings }: { slide: Slide; settings?: InvitationSettings }) {
  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : 'Menuju hari bahagia'
  const target = parseEventAt(p, settings)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  if (!target) {
    return (
      <article className="slide-inner slide-countdown slide-countdown--empty">
        <h2 className="slide-countdown__title">{title}</h2>
        <p className="muted small">Atur <code>event_at</code> di payload slide atau di pengaturan undangan.</p>
        <span className="slide-type">{slide.slide_type}</span>
      </article>
    )
  }

  const diff = target.getTime() - now
  const past = diff <= 0
  const totalSec = past ? 0 : Math.floor(diff / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  return (
    <article className="slide-inner slide-countdown">
      <h2 className="slide-countdown__title">{title}</h2>
      {past ? (
        <p className="slide-countdown__done">Hari bahagia telah tiba ✨</p>
      ) : (
        <div className="slide-countdown__grid" role="timer" aria-live="polite">
          <div>
            <span className="slide-countdown__num">{days}</span>
            <span className="slide-countdown__unit">hari</span>
          </div>
          <div>
            <span className="slide-countdown__num">{String(hours).padStart(2, '0')}</span>
            <span className="slide-countdown__unit">jam</span>
          </div>
          <div>
            <span className="slide-countdown__num">{String(mins).padStart(2, '0')}</span>
            <span className="slide-countdown__unit">menit</span>
          </div>
          <div>
            <span className="slide-countdown__num">{String(secs).padStart(2, '0')}</span>
            <span className="slide-countdown__unit">detik</span>
          </div>
        </div>
      )}
      <p className="slide-countdown__when muted small">{target.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function SlideGallery({ slide }: { slide: Slide }) {
  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : 'Galeri'
  const raw = p.images
  const images = Array.isArray(raw) ? raw.filter((u): u is string => typeof u === 'string' && u.length > 0) : []
  if (images.length === 0) {
    return (
      <article className="slide-inner">
        <h2>{title}</h2>
        <p className="muted small">Tambahkan array <code>images</code> berisi URL gambar.</p>
        <span className="slide-type">{slide.slide_type}</span>
      </article>
    )
  }
  return (
    <article className="slide-inner slide-gallery">
      <h2 className="slide-gallery__title">{title}</h2>
      <div className="slide-gallery__grid">
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="slide-gallery__cell">
            <img src={src} alt="" loading="lazy" decoding="async" sizes={INVITE_IMG_SIZES} />
          </div>
        ))}
      </div>
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function SlideCouple({ slide }: { slide: Slide }) {
  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : 'Mempelai'
  const groom = typeof p.groom_name === 'string' ? p.groom_name : ''
  const bride = typeof p.bride_name === 'string' ? p.bride_name : ''
  const gp = typeof p.groom_parents === 'string' ? p.groom_parents : ''
  const bp = typeof p.bride_parents === 'string' ? p.bride_parents : ''
  const gph = typeof p.groom_photo === 'string' ? p.groom_photo.trim() : ''
  const bph = typeof p.bride_photo === 'string' ? p.bride_photo.trim() : ''
  return (
    <article className="slide-inner slide-couple">
      <h2 className="slide-couple__title">{title}</h2>
      <div className="slide-couple__grid">
        <div className="slide-couple__half">
          {gph ? (
            <div className="slide-couple__photo">
              <img src={gph} alt="" loading="lazy" decoding="async" sizes={INVITE_IMG_SIZES} />
            </div>
          ) : null}
          <h3 className="slide-couple__name">{groom || '—'}</h3>
          {gp ? <p className="slide-couple__parents muted small">{gp}</p> : null}
        </div>
        <div className="slide-couple__heart" aria-hidden>
          ♥
        </div>
        <div className="slide-couple__half">
          {bph ? (
            <div className="slide-couple__photo">
              <img src={bph} alt="" loading="lazy" decoding="async" sizes={INVITE_IMG_SIZES} />
            </div>
          ) : null}
          <h3 className="slide-couple__name">{bride || '—'}</h3>
          {bp ? <p className="slide-couple__parents muted small">{bp}</p> : null}
        </div>
      </div>
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function SlideEventDetail({ slide }: { slide: Slide }) {
  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : 'Acara'
  const dateLabel = typeof p.date_label === 'string' ? p.date_label : ''
  const timeLabel = typeof p.time_label === 'string' ? p.time_label : ''
  const venue = typeof p.venue === 'string' ? p.venue : ''
  const address = typeof p.address === 'string' ? p.address : ''
  const dress = typeof p.dress_code === 'string' ? p.dress_code : ''
  const mapsUrl = typeof p.maps_url === 'string' ? p.maps_url.trim() : ''
  return (
    <article className="slide-inner slide-event">
      <h2 className="slide-event__title">{title}</h2>
      {dateLabel ? <p className="slide-event__line">{dateLabel}</p> : null}
      {timeLabel ? <p className="slide-event__line">{timeLabel}</p> : null}
      {venue ? <p className="slide-event__venue">{venue}</p> : null}
      {address ? <p className="slide-event__addr muted small">{address}</p> : null}
      {dress ? (
        <p className="slide-event__dress">
          <span className="slide-event__dress-label">Dress code</span> {dress}
        </p>
      ) : null}
      {mapsUrl ? (
        <a className="btn small slide-event__maps" href={mapsUrl} target="_blank" rel="noreferrer">
          Buka di Google Maps
        </a>
      ) : null}
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function parseAgendaItemsPublic(p: Record<string, unknown>): { time: string; label: string; detail: string }[] {
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

function SlideAgenda({ slide }: { slide: Slide }) {
  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : 'Susunan acara'
  const items = parseAgendaItemsPublic(p).filter((r) => r.time.trim() || r.label.trim() || r.detail.trim())
  if (items.length === 0) {
    return (
      <article className="slide-inner">
        <h2>{title}</h2>
        <p className="muted small">Isi daftar acara di panel editor.</p>
        <span className="slide-type">{slide.slide_type}</span>
      </article>
    )
  }
  return (
    <article className="slide-inner slide-agenda">
      <h2 className="slide-agenda__title">{title}</h2>
      <ul className="slide-agenda__list">
        {items.map((row, i) => (
          <li key={i} className="slide-agenda__item">
            <span className="slide-agenda__time">{row.time || '—'}</span>
            <div className="slide-agenda__body">
              <span className="slide-agenda__label">{row.label}</span>
              {row.detail ? <span className="slide-agenda__detail muted small">{row.detail}</span> : null}
            </div>
          </li>
        ))}
      </ul>
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function parseGiftAccountsPublic(p: Record<string, unknown>): { bank: string; holder: string; number: string; note: string }[] {
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

function SlideGift({ slide }: { slide: Slide }) {
  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : 'Amplop digital'
  const intro = typeof p.intro === 'string' ? p.intro : ''
  const accounts = parseGiftAccountsPublic(p).filter((a) => a.bank.trim() || a.number.trim())
  async function copyNum(s: string) {
    try {
      await navigator.clipboard.writeText(s)
    } catch {
      /* ignore */
    }
  }
  return (
    <article className="slide-inner slide-gift">
      <h2 className="slide-gift__title">{title}</h2>
      {intro ? <p className="slide-gift__intro">{intro}</p> : null}
      {accounts.length === 0 ? (
        <p className="muted small">Tambahkan rekening di editor.</p>
      ) : (
        <ul className="slide-gift__accounts">
          {accounts.map((a, i) => (
            <li key={i} className="slide-gift__card">
              {a.bank ? <div className="slide-gift__bank">{a.bank}</div> : null}
              {a.holder ? <div className="slide-gift__holder muted small">a.n. {a.holder}</div> : null}
              {a.number ? (
                <div className="slide-gift__row">
                  <code className="slide-gift__num">{a.number}</code>
                  <button type="button" className="btn ghost small" onClick={() => void copyNum(a.number)}>
                    Salin
                  </button>
                </div>
              ) : null}
              {a.note ? <p className="slide-gift__note muted small">{a.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function SlideVideo({ slide }: { slide: Slide }) {
  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : 'Video'
  const raw = typeof p.embed_url === 'string' ? p.embed_url.trim() : ''
  const embed = raw ? toYouTubeEmbedUrl(raw) : ''
  if (!embed) {
    return (
      <article className="slide-inner">
        <h2>{title}</h2>
        <p className="muted small">Tautan YouTube belum diisi.</p>
        <span className="slide-type">{slide.slide_type}</span>
      </article>
    )
  }
  return (
    <article className="slide-inner slide-video">
      <h2 className="slide-video__title">{title}</h2>
      <div className="slide-video__frame">
        <iframe title={title} src={embed} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function SlideGuestbookIntro({ slide }: { slide: Slide }) {
  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : 'Ucapan & doa'
  const body = typeof p.body === 'string' ? p.body : ''
  return (
    <article className="slide-inner slide-guestbook-intro">
      <h2 className="slide-guestbook-intro__title">{title}</h2>
      {body ? <p className="slide-guestbook-intro__body">{body}</p> : null}
      <p className="muted small slide-guestbook-intro__hint">Gulir ke bawah untuk membaca dan menulis ucapan.</p>
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function SlideMap({ slide }: { slide: Slide }) {
  const p = slide.payload
  const label = typeof p.label === 'string' ? p.label : 'Lokasi'
  const embedUrl = typeof p.embed_url === 'string' ? p.embed_url : ''
  if (!embedUrl) {
    return (
      <article className="slide-inner">
        <h2>{label}</h2>
        <p className="muted small">Isi <code>embed_url</code> dengan URL embed Google Maps.</p>
        <span className="slide-type">{slide.slide_type}</span>
      </article>
    )
  }
  return (
    <article className="slide-inner slide-map">
      <h2 className="slide-map__label">{label}</h2>
      <div className="slide-map__frame">
        <iframe title={label} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

function SlideView({ slide, settings }: { slide: Slide; settings?: InvitationSettings }) {
  if (slide.slide_type === 'features') {
    return <SlideFeatures slide={slide} />
  }
  if (slide.slide_type === 'quote') {
    return <SlideQuote slide={slide} />
  }
  if (slide.slide_type === 'countdown') {
    return <SlideCountdown slide={slide} settings={settings} />
  }
  if (slide.slide_type === 'gallery') {
    return <SlideGallery slide={slide} />
  }
  if (slide.slide_type === 'map') {
    return <SlideMap slide={slide} />
  }
  if (slide.slide_type === 'couple') {
    return <SlideCouple slide={slide} />
  }
  if (slide.slide_type === 'event') {
    return <SlideEventDetail slide={slide} />
  }
  if (slide.slide_type === 'video') {
    return <SlideVideo slide={slide} />
  }
  if (slide.slide_type === 'agenda') {
    return <SlideAgenda slide={slide} />
  }
  if (slide.slide_type === 'gift') {
    return <SlideGift slide={slide} />
  }
  if (slide.slide_type === 'guestbook') {
    return <SlideGuestbookIntro slide={slide} />
  }

  const p = slide.payload
  const title = typeof p.title === 'string' ? p.title : undefined
  const subtitle = typeof p.subtitle === 'string' ? p.subtitle : undefined
  const body = typeof p.body === 'string' ? p.body : undefined
  const image =
    typeof p.image_url === 'string'
      ? p.image_url
      : typeof p.image === 'string'
        ? p.image
        : undefined

  return (
    <article className="slide-inner">
      {image && (
        <div className="slide-img-wrap">
          <img
            src={image}
            alt=""
            className="slide-img"
            loading="lazy"
            decoding="async"
            sizes={INVITE_IMG_SIZES}
          />
        </div>
      )}
      <div className="slide-text">
        {title && <h2>{title}</h2>}
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {body && <p className="body">{body}</p>}
        {!title && !body && !image && (
          <pre className="payload-fallback">{JSON.stringify(p, null, 2)}</pre>
        )}
      </div>
      <span className="slide-type">{slide.slide_type}</span>
    </article>
  )
}

export function PublicInvite() {
  const { slug: slugParam = '', id: inviteIdParam = '' } = useParams<{ slug?: string; id?: string }>()
  const previewMode = Boolean(inviteIdParam)
  const slug = slugParam
  const [search] = useSearchParams()
  const tokenFromUrl = search.get('token') ?? ''

  const [data, setData] = useState<PublicInvitation | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const qs = useMemo(() => {
    if (!tokenFromUrl) return ''
    return `?token=${encodeURIComponent(tokenFromUrl)}`
  }, [tokenFromUrl])

  useEffect(() => {
    if (previewMode) {
      if (!inviteIdParam) return
      const token = getToken()
      if (!token) {
        setLoadErr('login_required')
        return
      }
      let cancelled = false
      setLoadErr(null)
      ;(async () => {
        const res = await apiFetch(`/api/v1/invitations/${encodeURIComponent(inviteIdParam)}/preview`, {
          token,
        })
        const j = (await res.json()) as PublicInvitation & { error?: string }
        if (cancelled) return
        if (!res.ok) {
          setLoadErr(j.error ?? 'gagal memuat pratinjau')
          return
        }
        setData(j)
      })()
      return () => {
        cancelled = true
      }
    }

    if (!slug) return
    let cancelled = false
    setLoadErr(null)
    ;(async () => {
      const res = await apiFetch(`/api/v1/public/invitations/${encodeURIComponent(slug)}${qs}`)
      const j = (await res.json()) as PublicInvitation & { error?: string }
      if (cancelled) return
      if (!res.ok) {
        setLoadErr(j.error ?? 'tidak ditemukan')
        return
      }
      setData(j)
    })()
    return () => {
      cancelled = true
    }
  }, [previewMode, inviteIdParam, slug, qs])

  const [wishes, setWishes] = useState<GuestWish[]>([])

  useEffect(() => {
    if (previewMode) {
      setWishes([])
      return
    }
    if (!slug) return
    let cancelled = false
    ;(async () => {
      const res = await apiFetch(`/api/v1/public/invitations/${encodeURIComponent(slug)}/wishes`)
      const j = (await res.json()) as { wishes?: GuestWish[] }
      if (!cancelled && res.ok) setWishes(j.wishes ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [slug, previewMode])

  const [tokenInput, setTokenInput] = useState(tokenFromUrl)

  useEffect(() => {
    setTokenInput(tokenFromUrl)
  }, [tokenFromUrl])
  const [rsvpMsg, setRsvpMsg] = useState<string | null>(null)
  const [rsvpErr, setRsvpErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [attending, setAttending] = useState(true)
  const [pax, setPax] = useState(1)
  const [rsvpMessage, setRsvpMessage] = useState('')

  const [wishAuthor, setWishAuthor] = useState('')
  const [wishMessage, setWishMessage] = useState('')
  const [wishErr, setWishErr] = useState<string | null>(null)
  const [wishOk, setWishOk] = useState<string | null>(null)
  const [wishSending, setWishSending] = useState(false)
  const [copyOk, setCopyOk] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [musicPlaying, setMusicPlaying] = useState(false)

  const storyRef = useRef<HTMLDivElement | null>(null)
  const [slideFocus, setSlideFocus] = useState<{
    index: number
    enterFrom: 'next' | 'prev' | null
  }>({ index: 0, enterFrom: null })

  const slideListSig = useMemo(
    () => (data?.slides?.length ? data.slides.map((s) => s.id).join('\0') : ''),
    [data?.slides],
  )

  useEffect(() => {
    setSlideFocus({ index: 0, enterFrom: null })
  }, [data?.id, slideListSig])

  useEffect(() => {
    const root = storyRef.current
    if (!root || !data?.slides?.length) return

    const compute = () => {
      const slides = root.querySelectorAll<HTMLElement>(':scope > .slide')
      if (slides.length === 0) return
      const rect = root.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      let best = 0
      let bestDist = Infinity
      slides.forEach((slide, i) => {
        const r = slide.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const d = Math.abs(cx - centerX)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      })
      setSlideFocus((prev) => {
        if (prev.index === best) return prev
        const enterFrom: 'next' | 'prev' = best > prev.index ? 'next' : 'prev'
        return { index: best, enterFrom }
      })
    }

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    const t = window.setTimeout(compute, 80)
    compute()
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
      root.removeEventListener('scroll', onScroll)
    }
  }, [data?.slides?.length, slideListSig])

  /**
   * WebKit / Chrome Android: swipe horizontal sering tidak meng-scroll parent `.story` bila ada
   * `.slide-inner` dengan overflow-y. Kunci sumbu lalu set scrollLeft di capture agar geser kiri/kanan jalan.
   */
  useEffect(() => {
    const root = storyRef.current
    if (!root || !data?.slides?.length || data.slides.length < 2) return

    const threshold = 10
    let startX = 0
    let startY = 0
    let startScrollLeft = 0
    let locked: 'h' | 'v' | null = null

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startScrollLeft = root.scrollLeft
      locked = null
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const x = e.touches[0].clientX
      const y = e.touches[0].clientY

      if (locked === null) {
        const dx = x - startX
        const dy = y - startY
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return
        locked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
      }

      if (locked === 'h') {
        e.preventDefault()
        root.scrollLeft = startScrollLeft - (x - startX)
      }
    }

    const onTouchEnd = () => {
      locked = null
    }

    const cap = { capture: true }
    root.addEventListener('touchstart', onTouchStart, { ...cap, passive: true })
    root.addEventListener('touchmove', onTouchMove, { ...cap, passive: false })
    root.addEventListener('touchend', onTouchEnd, { ...cap, passive: true })
    root.addEventListener('touchcancel', onTouchEnd, { ...cap, passive: true })

    return () => {
      root.removeEventListener('touchstart', onTouchStart, cap)
      root.removeEventListener('touchmove', onTouchMove, cap)
      root.removeEventListener('touchend', onTouchEnd, cap)
      root.removeEventListener('touchcancel', onTouchEnd, cap)
    }
  }, [data?.slides?.length, slideListSig])

  useEffect(() => {
    if (!data) return
    const t = data.title?.trim() || 'Undangan'
    document.title = t
    const desc = data.settings?.meta_description?.trim()
    let el = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', 'description')
      document.head.appendChild(el)
    }
    if (desc) el.setAttribute('content', desc)
    const og = data.settings?.og_image_url?.trim()
    let ogIm = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null
    if (!ogIm) {
      ogIm = document.createElement('meta')
      ogIm.setAttribute('property', 'og:image')
      document.head.appendChild(ogIm)
    }
    if (og) ogIm.setAttribute('content', og)
  }, [data])

  useEffect(() => {
    const n = data?.guest?.name
    if (n) setWishAuthor(n)
  }, [data?.guest?.name])

  useEffect(() => {
    const el = audioRef.current
    const url = data?.settings?.music_url?.trim()
    if (!el || !url) return
    el.src = url
    el.loop = true
  }, [data])

  useEffect(() => {
    const el = audioRef.current
    const url = data?.settings?.music_url?.trim()
    if (!el || !url) return
    if (musicPlaying) {
      void el.play().catch(() => setMusicPlaying(false))
    } else {
      el.pause()
    }
  }, [musicPlaying, data])

  async function onRsvp(e: FormEvent) {
    e.preventDefault()
    if (previewMode) return
    setRsvpErr(null)
    setRsvpMsg(null)
    const tok = tokenInput.trim()
    if (!tok) {
      setRsvpErr('Token tamu wajib (dari link undangan).')
      return
    }
    const publicSlug = data?.slug ?? slug
    if (!publicSlug) return
    setSubmitting(true)
    try {
      const msg = rsvpMessage.trim()
      const res = await apiFetch(`/api/v1/public/invitations/${encodeURIComponent(publicSlug)}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tok,
          data: {
            attending,
            pax,
            ...(msg ? { message: msg } : {}),
          },
        }),
      })
      const j = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) {
        setRsvpErr(j.error ?? 'gagal kirim')
        return
      }
      setRsvpMsg('Konfirmasi tersimpan. Terima kasih.')
    } catch {
      setRsvpErr('tidak terhubung ke server')
    } finally {
      setSubmitting(false)
    }
  }

  if (previewMode && !inviteIdParam) {
    return <p className="muted">ID undangan tidak valid.</p>
  }
  if (!previewMode && !slug) {
    return <p className="muted">Alamat undangan tidak valid.</p>
  }

  if (loadErr === 'login_required') {
    return (
      <div className="page public-error">
        <p className="error">Login diperlukan untuk melihat pratinjau.</p>
        <Link to="/login">Masuk</Link>
      </div>
    )
  }

  if (loadErr) {
    return (
      <div className="page public-error">
        <p className="error">{loadErr}</p>
        {!previewMode && (
          <p className="muted small">Pastikan undangan sudah dipublikasikan (is_published).</p>
        )}
        <Link to="/">Beranda</Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="story-loading">
        <p>Memuat undangan…</p>
      </div>
    )
  }

  const guestName = data.guest?.name
  const inviteSettings = data.settings
  const accent = inviteSettings?.accent_color?.trim() || '#c76b8f'
  const fontStack = inviteSettings?.font_family?.trim()
  const musicUrl = inviteSettings?.music_url?.trim()
  const bgUrl = inviteSettings?.background_image_url?.trim()
  const showTypeLabels = inviteSettings?.show_slide_type_labels === true
  const visualTheme = sanitizeTheme(inviteSettings?.theme)
  const themeTypo = getThemeTypography(visualTheme)

  async function onWish(e: FormEvent) {
    e.preventDefault()
    if (previewMode) return
    setWishErr(null)
    setWishOk(null)
    const author = wishAuthor.trim()
    const msg = wishMessage.trim()
    if (!author) {
      setWishErr('Nama pengirim wajib diisi.')
      return
    }
    if (!msg) {
      setWishErr('Ucapan tidak boleh kosong.')
      return
    }
    const publicSlug = data?.slug ?? slug
    if (!publicSlug) return
    setWishSending(true)
    try {
      const res = await apiFetch(`/api/v1/public/invitations/${encodeURIComponent(publicSlug)}/wishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenFromUrl.trim() || undefined,
          author_name: author,
          message: msg,
        }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) {
        setWishErr(j.error === 'invalid_token' ? 'Token tidak valid.' : j.error ?? 'gagal kirim')
        return
      }
      setWishOk('Ucapan terkirim. Terima kasih.')
      setWishMessage('')
      const r = await apiFetch(`/api/v1/public/invitations/${encodeURIComponent(publicSlug)}/wishes`)
      const wj = (await r.json()) as { wishes?: GuestWish[] }
      if (r.ok) setWishes(wj.wishes ?? [])
    } catch {
      setWishErr('tidak terhubung ke server')
    } finally {
      setWishSending(false)
    }
  }

  function downloadIcs() {
    const raw = inviteSettings?.event_at
    if (!raw) return
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return
    const slugFile = data?.slug ?? slug ?? 'undangan'
    const ics = buildEventICS({
      title: data?.title?.trim() || 'Acara pernikahan',
      description: `Undangan: ${slugFile}`,
      start: d,
      durationMinutes: 180,
    })
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `acara-${slugFile}.ics`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function shareUrlForClipboard(): string {
    const origin = window.location.origin
    const publicSlug = data?.slug ?? slug
    if (previewMode) {
      if (data?.is_published && publicSlug) {
        return `${origin}/i/${encodeURIComponent(publicSlug)}`
      }
      return `${origin}/preview/${inviteIdParam}`
    }
    const base = `${origin}/i/${encodeURIComponent(publicSlug)}`
    return tokenFromUrl ? `${base}?token=${encodeURIComponent(tokenFromUrl)}` : base
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(shareUrlForClipboard())
      setCopyOk(true)
      window.setTimeout(() => setCopyOk(false), 2200)
    } catch {
      setCopyOk(false)
    }
  }

  return (
    <div
      className={`public-invite public-invite--theme-${visualTheme}${showTypeLabels ? '' : ' public-invite--hide-types'}`}
      style={{
        ['--invite-accent' as string]: accent,
        ['--invite-display' as string]: themeTypo.displayStack,
        ['--invite-bg-url' as string]: bgUrl ? `url("${bgUrl.replace(/"/g, '%22')}")` : 'none',
        fontFamily: fontStack || themeTypo.bodyStack,
      }}
    >
      {previewMode && (
        <div className="preview-banner">
          <p>
            <strong>Mode pratinjau</strong> — tampilan mirip yang dilihat tamu.{' '}
            {data && !data.is_published
              ? 'Undangan masih draf: RSVP dan ucapan tidak diproses dari halaman ini.'
              : null}{' '}
            <Link to={`/dashboard/invitations/${inviteIdParam}`}>← Kembali ke kelola</Link>
          </p>
        </div>
      )}
      {musicUrl && (
        <>
          <audio ref={audioRef} preload="none" />
          <div className="music-bar">
            <button
              type="button"
              className={`music-bar__btn${musicPlaying ? ' music-bar__btn--playing' : ''}`}
              onClick={() => setMusicPlaying((v) => !v)}
              aria-pressed={musicPlaying}
              aria-label={musicPlaying ? 'Jeda musik latar' : 'Putar musik latar'}
            >
              <span className="music-bar__disc" aria-hidden>
                <svg viewBox="0 0 40 40" width="36" height="36" className="music-bar__disc-svg">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
                  <circle cx="20" cy="20" r="6" fill="currentColor" opacity="0.9" />
                  <circle cx="20" cy="20" r="2.2" fill="#120c0f" />
                </svg>
              </span>
              <span className="music-bar__label">{musicPlaying ? 'Jeda' : 'Musik'}</span>
            </button>
          </div>
        </>
      )}
      <div className="invite-main">
        <header className="story-top">
          <StoryTopBrand theme={visualTheme} headerImageUrl={inviteSettings?.header_image_url} />
          {data.title && <h1>{data.title}</h1>}
          {guestName && <p className="greeting">Halo, {guestName}</p>}
          <div className="public-invite__share">
            <button type="button" className="btn small" onClick={() => void copyInviteLink()}>
              {copyOk ? 'Tersalin' : 'Salin tautan'}
            </button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                type="button"
                className="btn small"
                onClick={() =>
                  void navigator.share({
                    title: data.title ?? 'Undangan',
                    url: shareUrlForClipboard(),
                  })
                }
              >
                Bagikan…
              </button>
            )}
            {inviteSettings?.event_at && (
              <button type="button" className="btn small" onClick={downloadIcs}>
                Simpan ke kalender
              </button>
            )}
          </div>
          <p className="hint-swipe">
            <span className="hint-swipe__text">Geser untuk membuka undangan</span>
          </p>
        </header>

        <div ref={storyRef} className="story" role="region" aria-label="Slide undangan">
          {data.slides?.length ? (
            data.slides.map((s, i) => {
              const active = slideFocus.index === i
              const dir = slideFocus.enterFrom
              const dirClass =
                active && dir === 'next' ? ' slide--enter-next' : active && dir === 'prev' ? ' slide--enter-prev' : ''
              return (
                <section
                  key={s.id}
                  className={`slide${active ? ' slide--active' : ''}${dirClass}`}
                  data-type={s.slide_type}
                  aria-current={active ? true : undefined}
                >
                  <SlideView slide={s} settings={inviteSettings} />
                </section>
              )
            })
          ) : (
            <section className="slide">
              <div className="slide-inner">
                <p>Belum ada slide. Tambahkan lewat API (PUT slides).</p>
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="wishes-panel" aria-label="Ucapan tamu">
        <h3>Ucapan &amp; doa</h3>
        {previewMode && (
          <p className="muted small preview-panel-hint">Pratinjau: daftar ucapan kosong; pengiriman ucapan dinonaktifkan.</p>
        )}
        <ul className="wishes-list">
          {wishes.map((w) => (
            <li key={w.id} className="wishes-list__item">
              <div className="wishes-list__meta">
                <strong>{w.author_name}</strong>
                <time dateTime={w.created_at}>{new Date(w.created_at).toLocaleString('id-ID')}</time>
              </div>
              <p className="wishes-list__msg">{w.message}</p>
            </li>
          ))}
        </ul>
        {wishes.length === 0 && <p className="muted small wishes-list__empty">Belum ada ucapan. Jadilah yang pertama.</p>}
        <form onSubmit={onWish} className="form wishes-form">
          <label>
            Nama
            <input
              value={wishAuthor}
              onChange={(e) => setWishAuthor(e.target.value)}
              placeholder="Nama Anda"
              autoComplete="name"
              disabled={previewMode}
            />
          </label>
          <label>
            Ucapan
            <textarea
              rows={3}
              value={wishMessage}
              onChange={(e) => setWishMessage(e.target.value)}
              placeholder="Doa dan harapan terbaik…"
              disabled={previewMode}
            />
          </label>
          {tokenFromUrl ? (
            <p className="muted small">Terhubung sebagai tamu terdaftar (token dari tautan).</p>
          ) : (
            <p className="muted small">Gunakan tautan undangan ber-token agar ucapan terverifikasi (opsional).</p>
          )}
          {wishErr && <p className="error">{wishErr}</p>}
          {wishOk && <p className="ok">{wishOk}</p>}
          <button type="submit" className="btn primary" disabled={wishSending || previewMode}>
            {wishSending ? '…' : 'Kirim ucapan'}
          </button>
        </form>
      </section>

      <footer className="rsvp-panel">
        <h3>Konfirmasi kehadiran</h3>
        {previewMode && (
          <p className="muted small preview-panel-hint">Pratinjau: form RSVP tidak mengirim data ke server.</p>
        )}
        <form onSubmit={onRsvp} className="form rsvp-form">
          <label>
            Token undangan
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="tempel dari link WA"
              autoComplete="off"
              disabled={previewMode}
            />
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={attending}
              onChange={(e) => setAttending(e.target.checked)}
              disabled={previewMode}
            />
            Hadir
          </label>
          <label>
            Jumlah orang
            <input
              type="number"
              min={0}
              value={pax}
              onChange={(e) => setPax(Number(e.target.value))}
              disabled={previewMode}
            />
          </label>
          <label>
            Pesan untuk mempelai (opsional)
            <textarea
              rows={2}
              value={rsvpMessage}
              onChange={(e) => setRsvpMessage(e.target.value)}
              placeholder="Ucapan singkat…"
              disabled={previewMode}
            />
          </label>
          {rsvpErr && <p className="error">{rsvpErr}</p>}
          {rsvpMsg && <p className="ok">{rsvpMsg}</p>}
          <button type="submit" className="btn primary" disabled={submitting || previewMode}>
            {submitting ? '…' : 'Kirim'}
          </button>
        </form>
      </footer>
    </div>
  )
}
