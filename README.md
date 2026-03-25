# Undangan Pernikahan (Web + API)

Aplikasi undangan pernikahan digital dengan **editor (studio)** untuk mengelola undangan, slide konten, tamu, RSVP, dan ucapan; serta **halaman publik** untuk dibagikan ke tamu.

Repo ini berisi:
- **API**: Go + Fiber + PostgreSQL
- **Web**: React + TypeScript + Vite
- **Storage aset**: S3-compatible (disarankan **MinIO** untuk dev lokal)

---

## Fitur Utama

### Admin / Studio
- **Login** (JWT) dan halaman dashboard.
- **Kelola undangan**: buat, update settings, publish/unpublish.
- **Editor slide**:
  - Edit payload per jenis slide (cover, quote, galeri, mempelai, dll).
  - Flow/canvas editor untuk urutan & posisi node.
- **Kelola tamu**: generate token tamu.
- **RSVP & ucapan**: lihat data RSVP & daftar ucapan.
- **Upload aset via MinIO (S3)**:
  - Upload **logo/header image** (foto bulat di atas judul).
  - Upload **background image** untuk halaman publik.

### Halaman Publik
- Tampilan undangan seperti **story portrait** dengan gestur geser.
- Tema (nuansa) + typography per tema.
- Musik latar (opsional).
- Panel RSVP & ucapan untuk tamu.
- Background: default gradient + **overlay warna-warni**, bisa ditambah foto background dari Studio.

---

## Tech Stack

### Backend (API)
- **Go**
- **Fiber** (`github.com/gofiber/fiber/v2`)
- **PostgreSQL** via `pgx`
- **JWT** (`github.com/golang-jwt/jwt/v5`)
- **Migrasi DB**: `goose`
- **S3/MinIO client**: AWS SDK v2 (`github.com/aws/aws-sdk-go-v2/...`)

### Frontend (Web)
- **React 19**
- **TypeScript**
- **Vite**
- **React Router**
- **@xyflow/react** (canvas/flow editor)

### Dev Infra
- **Docker Compose**: Postgres + MinIO

---

## Struktur Folder

- `cmd/api/` — entrypoint server API
- `cmd/seed/` — seeding akun superadmin
- `internal/` — domain utama backend (handler, repository, middleware, storage, dll.)
- `web/` — aplikasi React (Studio + halaman publik)

---

## Menjalankan di Lokal (Dev)

### Prasyarat
- Go (sesuai `go.mod`)
- Node.js + npm
- Docker Desktop

### 1) Jalankan Postgres + MinIO

Di root project:

```powershell
cd d:\personal_project\undangan_pernikahan
docker-compose up -d
```

MinIO Console:
- `http://localhost:9001`
- user: `minioadmin`
- password: `minioadmin123`

Bucket default untuk aset: `undangan-assets` (dibuat otomatis oleh service `minio_init`).

### 2) Set environment API (PowerShell)

```powershell
# Database
$env:DATABASE_URL="postgres://undangan:undangan_dev@localhost:5432/undangan?sslmode=disable"

# JWT (opsional untuk dev, default ada di config)
# $env:JWT_SECRET="..."

# S3/MinIO
$env:S3_ENDPOINT="http://localhost:9000"
$env:S3_PUBLIC_BASE_URL="http://localhost:9000"
$env:S3_REGION="us-east-1"
$env:S3_BUCKET="undangan-assets"
$env:S3_ACCESS_KEY_ID="minioadmin"
$env:S3_SECRET_ACCESS_KEY="minioadmin123"
```

### 3) Jalankan API

```powershell
go run .\cmd\api
```

API default berjalan di:
- `http://127.0.0.1:8081`

Catatan: API sudah di-set `BodyLimit` lebih besar untuk upload multipart.

### 4) (Sekali saja) Seed superadmin

Di terminal yang sama (agar env kebaca):

```powershell
$env:SUPERADMIN_EMAIL="admin@local.test"
$env:SUPERADMIN_PASSWORD="admin12345"
go run .\cmd\seed
```

Output sukses:
- `superadmin siap: <email>`

### 5) Jalankan Web (Vite)

```powershell
cd .\web
npm.cmd install
npm.cmd run dev
```

Web akan jalan di:
- `http://localhost:5173`

---

## Akses dari HP (Satu Wi‑Fi)

Di Windows, `localhost` di HP tidak menunjuk ke laptop. Gunakan IP laptop (contoh: `192.168.1.7`).

1) Pastikan Vite menampilkan alamat `Network`, mis:
   - `http://192.168.1.7:5173`
2) Buka alamat itu dari browser HP.
3) Jika tidak bisa diakses, izinkan port 5173 di Windows Firewall:

```powershell
netsh advfirewall firewall add rule name="Vite dev 5173" dir=in action=allow protocol=TCP localport=5173
```

---

## Konfigurasi (Env Vars)

### API
- `DATABASE_URL` — koneksi Postgres (wajib untuk fitur /api/v1)
- `PORT` — default `8081`
- `JWT_SECRET` — default dev tersedia, wajib di production
- `CORS_ORIGINS` — default mengizinkan Vite di `:5173`

### S3/MinIO (Upload Aset)
- `S3_ENDPOINT` — contoh `http://localhost:9000`
- `S3_PUBLIC_BASE_URL` — base URL untuk akses publik object (default = endpoint)
- `S3_REGION` — contoh `us-east-1`
- `S3_BUCKET` — contoh `undangan-assets`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

### Seed Superadmin
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`

---

## Endpoint Penting (Ringkas)

### Auth
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-email`
- `GET /api/v1/me` (auth)

### Invitation (auth)
- `POST /api/v1/invitations`
- `GET /api/v1/invitations`
- `GET /api/v1/invitations/:id`
- `PATCH /api/v1/invitations/:id`
- `PUT /api/v1/invitations/:id/slides`
- `GET /api/v1/invitations/:id/preview`

### Public
- `GET /api/v1/public/invitations/:slug`
- `GET/POST /api/v1/public/invitations/:slug/wishes`
- `POST /api/v1/public/invitations/:slug/rsvp`

### Assets (auth)
- `POST /api/v1/assets/header-image` — upload logo/header (foto bulat)
- `POST /api/v1/assets/background-image` — upload background

---

## Cara Ganti Logo & Background

Di **Invitation Studio → Tab “Tampilan & musik”**:
- **Logo/Header**: upload file → tersimpan ke `settings.header_image_url` → header di halaman publik akan menampilkan foto bulat (menggantikan ikon tema).
- **Background**: upload file → tersimpan ke `settings.background_image_url` → background halaman publik memakai foto + overlay warna-warni.

---

## Troubleshooting

### `invalid_credentials` saat login
- Pastikan sudah menjalankan `go run .\cmd\seed` untuk email/password yang kamu pakai.
- Pastikan API berjalan dengan `DATABASE_URL` yang benar (DB tidak `nil`).

### Upload aset gagal / `ECONNRESET`
- Pastikan MinIO up (`docker-compose up -d`).
- Pastikan env `S3_*` diset di terminal yang menjalankan API.
- Cek terminal API untuk error S3/MinIO.

---

## Lisensi

Belum ditentukan (default: semua hak cipta dilindungi pemilik repo).

