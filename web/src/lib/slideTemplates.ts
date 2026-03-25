/** Template payload default per tipe slide (editor undangan). */

export const SLIDE_TYPE_OPTIONS: { type: string; label: string; hint: string }[] = [
  { type: 'cover', label: 'Cover / Pembuka', hint: 'Judul, subtitle, teks' },
  { type: 'couple', label: 'Mempelai', hint: 'Nama, orang tua, foto' },
  { type: 'quote', label: 'Quote / Ayat', hint: 'Kutipan singkat' },
  { type: 'countdown', label: 'Hitung mundur', hint: 'Waktu acara (ISO)' },
  { type: 'event', label: 'Detail acara', hint: 'Tanggal, lokasi, dress code' },
  { type: 'gallery', label: 'Galeri foto', hint: 'Daftar URL gambar' },
  { type: 'map', label: 'Peta / Lokasi', hint: 'URL embed Google Maps' },
  { type: 'video', label: 'Video / streaming', hint: 'YouTube embed' },
  { type: 'agenda', label: 'Susunan acara', hint: 'Timeline rundown' },
  { type: 'gift', label: 'Amplop digital', hint: 'Rekening / e-wallet' },
  { type: 'guestbook', label: 'Buku ucapan (pengantar)', hint: 'Teks pengantar; ucapan di bawah halaman' },
  { type: 'features', label: 'Daftar fitur', hint: 'Checklist' },
  { type: 'closing', label: 'Penutup', hint: 'Ucapan penutup' },
]

export function defaultPayloadForType(slideType: string): Record<string, unknown> {
  switch (slideType) {
    case 'cover':
      return { title: 'The Wedding of', subtitle: 'Nama mempelai', body: 'Detail acara' }
    case 'couple':
      return {
        title: 'Memperkenalkan',
        groom_name: 'Nama mempelai pria',
        bride_name: 'Nama mempelai wanita',
        groom_parents: 'Putra dari Bapak … & Ibu …',
        bride_parents: 'Putri dari Bapak … & Ibu …',
        groom_photo: '',
        bride_photo: '',
      }
    case 'quote':
      return { text: 'Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu', author: '' }
    case 'countdown':
      return { title: 'Menuju hari bahagia', event_at: new Date(Date.now() + 86400000 * 30).toISOString() }
    case 'event':
      return {
        title: 'Rangkaian acara',
        date_label: 'Sabtu, 12 Juli 2025',
        time_label: '10.00 WIB – selesai',
        venue: 'Nama gedung / venue',
        address: 'Alamat lengkap',
        dress_code: 'Busana formal / adat',
        maps_url: '',
      }
    case 'gallery':
      return { title: 'Galeri', images: [] as string[] }
    case 'map':
      return { label: 'Lokasi acara', embed_url: 'https://www.google.com/maps/embed?pb=...' }
    case 'video':
      return { title: 'Cerita kami', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }
    case 'agenda':
      return {
        title: 'Susunan acara',
        items: [
          { time: '10.00', label: 'Pembukaan', detail: '' },
          { time: '11.00', label: 'Akad / Pemberkatan', detail: '' },
          { time: '12.00', label: 'Resepsi', detail: '' },
        ],
      }
    case 'gift':
      return {
        title: 'Amplop digital',
        intro: 'Doa restu Anda merupakan hadiah terindah. Bagi yang ingin mengirimkan tanda kasih:',
        accounts: [{ bank: 'BCA', holder: 'Nama pemilik rekening', number: '1234567890', note: '' }],
      }
    case 'guestbook':
      return {
        title: 'Ucapan & doa',
        body: 'Kehadiran dan doa restu Anda sangat berarti bagi kami. Silakan tinggalkan ucapan di bagian bawah halaman.',
      }
    case 'features':
      return {
        heading: 'Detail paket',
        lead_first: true,
        initial_visible: 8,
        items: ['Fitur 1', 'Fitur 2', 'Fitur 3'],
      }
    case 'closing':
      return { title: 'Terima kasih', body: 'Doa restu Anda berarti bagi kami.' }
    default:
      return { title: '', body: '' }
  }
}
