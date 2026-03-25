package main

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"undangan_pernikahan/internal/config"
	"undangan_pernikahan/internal/database"
	"undangan_pernikahan/internal/server"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	var pool *pgxpool.Pool
	if cfg.DatabaseURL != "" {
		db, err := database.Open(ctx, cfg.DatabaseURL)
		if err != nil {
			log.Fatal(err)
		}
		defer db.Close()
		if err := database.RunMigrations(ctx, db.Pool); err != nil {
			log.Fatal(err)
		}
		pool = db.Pool
	}

	app := server.New(cfg, pool)

	addr := ":" + cfg.Port
	log.Printf("undangan api listening on %s (%s)", addr, cfg.Env)
	if err := app.Listen(addr); err != nil {
		log.Fatal(err)
	}
}
