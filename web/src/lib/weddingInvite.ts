/** URL embed YouTube dari tautan share / watch. */
export function toYouTubeEmbedUrl(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (s.includes('youtube.com/embed/')) return s
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    if (u.hostname === 'youtu.be' || u.hostname.endsWith('.youtu.be')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id ? `https://www.youtube.com/embed/${id}` : s
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
      const m = u.pathname.match(/\/embed\/([^/?]+)/)
      if (m?.[1]) return `https://www.youtube.com/embed/${m[1]}`
    }
  } catch {
    /* ignore */
  }
  return s
}

/** Bangun konten .ics sederhana (satu acara). */
export function buildEventICS(opts: {
  title: string
  description?: string
  location?: string
  start: Date
  durationMinutes?: number
}): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  const end = new Date(opts.start.getTime() + (opts.durationMinutes ?? 120) * 60 * 1000)
  const uid = `${fmt(opts.start)}-${Math.random().toString(36).slice(2)}@undangan`
  const esc = (t: string) =>
    t
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Undangan Digital//ID',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : '',
    opts.location ? `LOCATION:${esc(opts.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n')
}
