import { BackgroundVariant } from '@xyflow/react'
import type { ThemeKey } from '../data/invitationTemplates'

/** Grid + warna titik/garis kanvas alur mengikuti tema halaman tamu. */
export type FlowBackgroundConfig = {
  variant: BackgroundVariant
  gap: number
  size: number
  color: string
}

export function getFlowBackgroundConfig(theme: ThemeKey): FlowBackgroundConfig {
  switch (theme) {
    case 'simple':
      return { variant: BackgroundVariant.Lines, gap: 28, size: 1, color: '#64748b' }
    case 'vintage':
      return { variant: BackgroundVariant.Cross, gap: 20, size: 1, color: '#a8a29e' }
    case 'floral':
      return { variant: BackgroundVariant.Dots, gap: 13, size: 1.15, color: '#db2777' }
    case 'minimal':
      return { variant: BackgroundVariant.Lines, gap: 36, size: 0.75, color: '#525252' }
    case 'ocean':
      return { variant: BackgroundVariant.Dots, gap: 18, size: 1, color: '#38bdf8' }
    case 'forest':
      return { variant: BackgroundVariant.Lines, gap: 22, size: 1, color: '#4ade80' }
    case 'romantic':
      return { variant: BackgroundVariant.Dots, gap: 15, size: 1, color: '#fb7185' }
    case 'classic_gold':
      return { variant: BackgroundVariant.Cross, gap: 24, size: 1, color: '#ca8a04' }
    case 'pastel':
      return { variant: BackgroundVariant.Dots, gap: 18, size: 1, color: '#c4b5fd' }
    case 'rustic':
      return { variant: BackgroundVariant.Cross, gap: 22, size: 1, color: '#d97706' }
    default:
      return { variant: BackgroundVariant.Dots, gap: 18, size: 1, color: '#475569' }
  }
}
