package server

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"

	"undangan_pernikahan/internal/config"
	"undangan_pernikahan/internal/handler"
)

// New membangun Fiber app dengan middleware dasar dan route awal.
// pool boleh nil jika DATABASE_URL tidak diset (mode dev tanpa Postgres; /api/v1 → 503).
func New(cfg config.Config, pool *pgxpool.Pool) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      "Undangan API",
		ServerHeader: "Undangan",
		// Upload aset (logo/header) memakai multipart; default Fiber 4MB terlalu kecil.
		BodyLimit: 10 * 1024 * 1024, // 10MB
	})

	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: false,
	}))
	app.Use(logger.New())

	// Browser meminta /favicon.ico otomatis; API tidak menyediakan ikon — hindari 404 di log.
	app.Get("/favicon.ico", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	handler.RegisterHealth(app, pool)
	RegisterV1(app, cfg, pool)

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "undangan-pernikahan-api",
			"env":     cfg.Env,
		})
	})

	return app
}
