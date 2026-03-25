import type { ReactNode } from 'react'
import type { ThemeKey } from '../data/invitationTemplates'
import { sanitizeTheme } from '../data/invitationTemplates'
import './ThemeIcon.css'

type Props = {
  theme: string | undefined | null
  className?: string
  /** Piksel (width & height) */
  size?: number
  /** Untuk aksesibilitas bila ikon berdiri sendiri */
  title?: string
  /** true = sembunyikan dari pembaca layar (mis. di dalam tombol yang sudah berlabel) */
  decorative?: boolean
}

const VB = '0 0 48 48'

function IconSimple() {
  return (
    <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="18" cy="24" r="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="30" cy="24" r="10" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function IconVintage() {
  return (
    <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M24 8 L32 14 L32 22 Q32 30 24 38 Q16 30 16 22 L16 14 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M20 18 H28 M24 14 V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconFloral() {
  return (
    <svg viewBox={VB} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="24" cy="16" r="5" opacity="0.9" />
      <circle cx="16" cy="22" r="5" opacity="0.85" />
      <circle cx="32" cy="22" r="5" opacity="0.85" />
      <circle cx="20" cy="30" r="5" opacity="0.8" />
      <circle cx="28" cy="30" r="5" opacity="0.8" />
      <circle cx="24" cy="24" r="4" opacity="1" />
    </svg>
  )
}

function IconMinimal() {
  return (
    <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="12" y="12" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="2" />
      <line x1="18" y1="24" x2="30" y2="24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconOcean() {
  return (
    <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M8 28 Q16 22 24 28 T40 28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 34 Q16 28 24 34 T40 34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      <path d="M34 12 L38 16 L34 20" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

function IconForest() {
  return (
    <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M24 10 L34 28 H14 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
      <rect x="21" y="28" width="6" height="10" fill="currentColor" rx="1" />
    </svg>
  )
}

function IconRomantic() {
  return (
    <svg viewBox={VB} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M24 38 C12 28 8 18 16 14 C20 12 24 16 24 16 C24 16 28 12 32 14 C40 18 36 28 24 38 Z" />
    </svg>
  )
}

function IconClassicGold() {
  return (
    <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M24 8 L30 18 L40 20 L32 28 L34 40 L24 34 L14 40 L16 28 L8 20 L18 18 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function IconPastel() {
  return (
    <svg viewBox={VB} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="16" cy="18" r="3" opacity="0.7" />
      <circle cx="32" cy="16" r="2.5" opacity="0.6" />
      <circle cx="26" cy="22" r="2" opacity="0.65" />
      <path
        d="M12 32 Q24 24 36 32 Q24 38 12 32"
        opacity="0.85"
      />
    </svg>
  )
}

function IconRustic() {
  return (
    <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="6" x2="24" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="37" x2="24" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="24" x2="11" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="37" y1="24" x2="42" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="37" y1="11" x2="34" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="37" x2="14" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="37" y1="37" x2="34" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const ICONS: Record<ThemeKey, ReactNode> = {
  simple: <IconSimple />,
  vintage: <IconVintage />,
  floral: <IconFloral />,
  minimal: <IconMinimal />,
  ocean: <IconOcean />,
  forest: <IconForest />,
  romantic: <IconRomantic />,
  classic_gold: <IconClassicGold />,
  pastel: <IconPastel />,
  rustic: <IconRustic />,
}

const LABELS: Record<ThemeKey, string> = {
  simple: 'Ikon cincin sederhana',
  vintage: 'Ikon gaya vintage',
  floral: 'Ikon bunga',
  minimal: 'Ikon minimal',
  ocean: 'Ikon ombak',
  forest: 'Ikon pohon',
  romantic: 'Ikon hati',
  classic_gold: 'Ikon bintang klasik',
  pastel: 'Ikon awan lembut',
  rustic: 'Ikon matahari rustic',
}

/** Ikon dekoratif per tema undangan (SVG, warna mengikuti `currentColor`). */
export function ThemeIcon({ theme, className, size = 48, title, decorative }: Props) {
  const key = sanitizeTheme(theme)
  const label = title ?? LABELS[key]
  if (decorative) {
    return (
      <span
        className={`theme-icon theme-icon--${key} ${className ?? ''}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {ICONS[key]}
      </span>
    )
  }
  return (
    <span
      className={`theme-icon theme-icon--${key} ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      {ICONS[key]}
    </span>
  )
}
