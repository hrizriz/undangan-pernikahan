package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

// RegisterHealth mendaftarkan endpoint cek kesehatan servis (opsional ping DB).
func RegisterHealth(app *fiber.App, pool *pgxpool.Pool) {
	app.Get("/health", func(c *fiber.Ctx) error {
		out := fiber.Map{"status": "ok"}
		if pool == nil {
			out["db"] = "skipped"
			return c.JSON(out)
		}
		if err := pool.Ping(c.Context()); err != nil {
			return c.Status(503).JSON(fiber.Map{
				"status": "error",
				"db":     err.Error(),
			})
		}
		out["db"] = "ok"
		return c.JSON(out)
	})
}
