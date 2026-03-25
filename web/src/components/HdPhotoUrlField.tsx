type Props = {
  legend: string
  value: string
  onChange: (next: string) => void
  /** Label singkat di atas input */
  inputLabel?: string
  placeholder?: string
}

/** Blok input URL foto HD untuk editor slide — konsisten di semua tipe slide yang punya gambar. */
export function HdPhotoUrlField({ legend, value, onChange, inputLabel = 'URL gambar', placeholder }: Props) {
  return (
    <fieldset className="hd-photo-field">
      <legend>{legend}</legend>
      <p className="muted small hd-photo-field__hint">
        Sisipkan URL gambar <strong>HD</strong> (disarankan lebar ≥ 1200px; WebP atau JPEG). Unggah dulu ke
        hosting/CDN, lalu tempel tautan langsung ke file gambar.
      </p>
      <label>
        {inputLabel}
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'https://contoh.com/foto-mempelai.jpg'}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    </fieldset>
  )
}
