export type Slide = {
  id: string
  sort_order: number
  slide_type: string
  payload: Record<string, unknown>
}

/** Draft slide di editor (alur / kanvas) — `clientKey` stabil per kartu. */
export type FlowDraftSlide = {
  clientKey: string
  slide_type: string
  payload: Record<string, unknown>
}

/** Koordinat node di kanvas editor (indeks = urutan slide). */
export type FlowNodePosition = { x: number; y: number }

/** Layout kanvas alur (tersimpan di `settings` undangan). */
export type FlowLayout = {
  nodes: FlowNodePosition[]
}

export type InvitationSettings = {
  accent_color?: string
  music_url?: string
  event_at?: string
  font_family?: string
  /** Tema tampilan halaman tamu (simple, vintage, floral, …). */
  theme?: string
  /** Deskripsi singkat untuk SEO / pratinjau tautan. */
  meta_description?: string
  /** Gambar pratinjau (URL absolut) saat dibagikan. */
  og_image_url?: string
  /** Foto bulat di atas judul (menggantikan ikon tema). URL https ke gambar mempelai / pasangan. */
  header_image_url?: string
  /** Background halaman tamu (foto). */
  background_image_url?: string
  /** Tampilkan label debug tipe slide di pojok kartu (default: tidak). */
  show_slide_type_labels?: boolean
  /** Editor saja — tidak dikirim ke halaman tamu. */
  flow_layout?: FlowLayout
}

export type PublicInvitation = {
  id: string
  slug: string
  title?: string | null
  is_published: boolean
  settings?: InvitationSettings
  slides: Slide[]
  guest?: { name: string; phone?: string | null }
}

export type InvitationSummary = {
  id: string
  slug: string
  title?: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

export type InvitationDetail = {
  id: string
  user_id: string
  slug: string
  title?: string | null
  is_published: boolean
  settings?: InvitationSettings
  slides: Slide[]
  created_at: string
  updated_at: string
}

export type Guest = {
  id: string
  invitation_id: string
  token: string
  name: string
  phone?: string | null
  created_at: string
}

export type RSVPEntry = {
  id: string
  invitation_id: string
  guest_id?: string | null
  guest_name?: string | null
  data: unknown
  created_at: string
}

export type GuestWish = {
  id: string
  invitation_id?: string
  guest_id?: string | null
  author_name: string
  message: string
  created_at: string
  /** Hanya respons publik GET /wishes */
  from_guest?: boolean
}
