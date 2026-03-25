package config

import (
	"os"
)

// Config konfigurasi runtime API (env).
type Config struct {
	Port        string
	Env         string
	DatabaseURL string // kosong = tanpa DB (hanya untuk dev); isi DATABASE_URL untuk Postgres
	JWTSecret   string // wajib di production; default dev hanya untuk lokal
	CORSOrigins string // koma-terpisah; kosong = default dev (Vite :5173)
	FrontendURL string // URL frontend untuk link verifikasi email
	MailHost    string // kosong = hanya log link verifikasi (dev)
	MailPort    string
	MailUser    string
	MailPass    string
	MailFrom    string // alamat From (email)

	// S3/MinIO (S3-compatible) untuk upload aset (logo/foto).
	S3Endpoint        string // contoh: http://localhost:9000 (MinIO)
	S3Region          string // contoh: us-east-1 (MinIO bebas)
	S3Bucket          string // contoh: undangan-assets
	S3AccessKeyID     string
	S3SecretAccessKey string
	S3PublicBaseURL   string // opsional: base URL publik untuk akses object (default = S3Endpoint)
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081" // hindari bentrok dengan layanan lain di :8080
	}
	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}
	jwt := os.Getenv("JWT_SECRET")
	if jwt == "" {
		jwt = "dev-insecure-change-me"
	}

	cors := os.Getenv("CORS_ORIGINS")
	if cors == "" {
		cors = "http://localhost:5173,http://127.0.0.1:5173"
	}

	front := os.Getenv("FRONTEND_URL")
	if front == "" {
		front = "http://localhost:5173"
	}
	mailPort := os.Getenv("MAIL_PORT")
	if mailPort == "" {
		mailPort = "587"
	}

	return Config{
		Port:        port,
		Env:         env,
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   jwt,
		CORSOrigins: cors,
		FrontendURL: front,
		MailHost:    os.Getenv("MAIL_HOST"),
		MailPort:    mailPort,
		MailUser:    os.Getenv("MAIL_USER"),
		MailPass:    os.Getenv("MAIL_PASS"),
		MailFrom:    os.Getenv("MAIL_FROM"),

		S3Endpoint:        os.Getenv("S3_ENDPOINT"),
		S3Region:          os.Getenv("S3_REGION"),
		S3Bucket:          os.Getenv("S3_BUCKET"),
		S3AccessKeyID:     os.Getenv("S3_ACCESS_KEY_ID"),
		S3SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"),
		S3PublicBaseURL:   os.Getenv("S3_PUBLIC_BASE_URL"),
	}
}
