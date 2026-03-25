import { Link } from 'react-router-dom'
import './home.css'

export function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="landing-logo">Undangan</span>
        <nav className="landing-nav-links" aria-label="Menu utama">
          <Link to="/login">Masuk</Link>
          <Link className="btn primary small" to="/register">
            Daftar
          </Link>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <p className="landing-eyebrow">Undangan digital · buat &amp; kelola sendiri</p>
          <h1 id="hero-title">Ucapkan dengan indah, bagikan dengan mudah</h1>
          <p className="landing-lead">
            Susun alur slide seperti alur cerita, pilih tema halaman tamu, undang dengan link unik — tanpa perlu
            mengirim file ke pihak ketiga untuk tiap revisi.
          </p>
          <div className="landing-cta-row">
            <Link className="btn primary" to="/register">
              Mulai gratis
            </Link>
            <Link className="btn" to="/login">
              Sudah punya akun
            </Link>
          </div>
          <p className="landing-code-hint">
            Tamu membuka undangan lewat link publik, contoh: <code>/i/slug-undangan</code>
          </p>
        </section>

        <section className="landing-section" aria-labelledby="why-title">
          <h2 id="why-title">Mengapa memakai dashboard ini?</h2>
          <p className="landing-sub">
            Pola yang dipakai studio undangan profesional — alur jelas, tampilan rapi — dikemas dalam alat yang Anda
            kendalikan sendiri.
          </p>
          <div className="landing-features">
            <article className="landing-feature">
              <h3>RSVP &amp; ucapan tamu</h3>
              <p>Kumpulkan konfirmasi kehadiran dan pesan di satu tempat, terstruktur per undangan.</p>
            </article>
            <article className="landing-feature">
              <h3>Tema halaman tamu</h3>
              <p>Pilih nuansa tampilan (simple, vintage, floral, …) agar selaras dengan gaya acara Anda.</p>
            </article>
            <article className="landing-feature">
              <h3>Pratinjau sebelum terbit</h3>
              <p>Lihat tampilan seperti tamu saat masih draf, lalu terbitkan ketika siap.</p>
            </article>
            <article className="landing-feature">
              <h3>Alur slide visual</h3>
              <p>Atur urutan slide di kanvas — mirip pipeline — supaya alur undangan mudah dipahami.</p>
            </article>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="how-title">
          <h2 id="how-title">Cara memulai</h2>
          <p className="landing-sub">Empat langkah singkat dari akun hingga undangan siap dibagikan.</p>
          <ol className="landing-steps">
            <li>
              <strong>Daftar &amp; masuk</strong>
              Buat akun, lalu buka dashboard undangan Anda.
            </li>
            <li>
              <strong>Buat undangan &amp; slug</strong>
              Tentukan URL yang mudah diingat untuk link tamu.
            </li>
            <li>
              <strong>Susun slide &amp; pengaturan</strong>
              Isi konten, tema, musik opsional, lalu simpan.
            </li>
            <li>
              <strong>Terbitkan &amp; bagikan</strong>
              Bagikan link publik; pantau RSVP dan ucapan dari dashboard.
            </li>
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="faq-title">
          <h2 id="faq-title">Pertanyaan yang sering diajukan</h2>
          <p className="landing-sub">Jawaban singkat — detail fitur dapat berkembang seiring pengembangan produk.</p>
          <div className="landing-faq">
            <details>
              <summary>Apakah tamu perlu membuat akun?</summary>
              <p>Tidak. Tamu cukup membuka link undangan Anda; RSVP mengisi formulir di halaman tamu.</p>
            </details>
            <details>
              <summary>Bisa mengubah urutan slide?</summary>
              <p>Ya. Di halaman kelola undangan, seret node di kanvas atau gunakan ringkasan slide untuk memilih slide.</p>
            </details>
            <details>
              <summary>Apakah data saya aman?</summary>
              <p>Akun dilindungi sandi; undangan hanya dapat diedit oleh pemilik yang masuk. Gunakan slug yang tidak mudah ditebak jika ingin privasi lebih.</p>
            </details>
          </div>
        </section>

        <footer className="landing-footer">
          <p>Dibuat untuk pasangan yang ingin undangan digital rapi dan terkendali.</p>
        </footer>
      </main>
    </div>
  )
}
