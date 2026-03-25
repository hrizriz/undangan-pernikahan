package main

import (
	"context"
	"log"
	"os"

	"undangan_pernikahan/internal/auth"
	"undangan_pernikahan/internal/config"
	"undangan_pernikahan/internal/database"
	"undangan_pernikahan/internal/repository"
)

// Jalankan sekali setelah migrasi: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, DATABASE_URL.
func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL wajib di-set")
	}
	email := os.Getenv("SUPERADMIN_EMAIL")
	pass := os.Getenv("SUPERADMIN_PASSWORD")
	if email == "" || pass == "" {
		log.Fatal("SUPERADMIN_EMAIL dan SUPERADMIN_PASSWORD wajib di-set")
	}

	ctx := context.Background()
	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := database.RunMigrations(ctx, db.Pool); err != nil {
		log.Fatalf("migrasi: %v", err)
	}

	hash, err := auth.HashPassword(pass)
	if err != nil {
		log.Fatal(err)
	}
	users := repository.NewUser(db.Pool)
	if err := users.UpsertSuperadmin(ctx, email, hash); err != nil {
		log.Fatal(err)
	}
	log.Printf("superadmin siap: %s\n", email)
}
