package server

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"undangan_pernikahan/internal/config"
	"undangan_pernikahan/internal/handler"
	"undangan_pernikahan/internal/middleware"
	"undangan_pernikahan/internal/repository"
	"undangan_pernikahan/internal/storage"
)

// RegisterV1 route API versi 1 (auth, undangan, publik). Tanpa DB → 503 untuk /api/v1/*.
func RegisterV1(app *fiber.App, cfg config.Config, pool *pgxpool.Pool) {
	if pool == nil {
		app.Use("/api/v1", func(c *fiber.Ctx) error {
			return c.Status(503).JSON(fiber.Map{
				"error": "database_not_configured",
			})
		})
		return
	}

	users := repository.NewUser(pool)
	invs := repository.NewInvitation(pool)
	guests := repository.NewGuest(pool)
	wishes := repository.NewWish(pool)

	authH := handler.NewAuth(users, cfg)
	invH := handler.NewInvitation(invs)
	guestH := handler.NewGuestHandler(invs, guests, wishes)
	pubH := handler.NewPublic(invs, guests, wishes)

	var s3c *storage.S3
	if cfg.S3Endpoint != "" || cfg.S3Bucket != "" || cfg.S3AccessKeyID != "" {
		s, err := storage.NewS3(context.Background(), storage.S3Config{
			Endpoint:        cfg.S3Endpoint,
			Region:          cfg.S3Region,
			Bucket:          cfg.S3Bucket,
			AccessKeyID:     cfg.S3AccessKeyID,
			SecretAccessKey: cfg.S3SecretAccessKey,
			PublicBaseURL:   cfg.S3PublicBaseURL,
		})
		if err == nil {
			s3c = s
		}
	}
	assetsH := handler.NewAssets(s3c, cfg)

	v1 := app.Group("/api/v1")

	v1.Post("/auth/register", authH.Register)
	v1.Post("/auth/verify-email", authH.VerifyEmail)
	v1.Post("/auth/login", authH.Login)
	v1.Get("/public/invitations/:slug", pubH.BySlug)
	v1.Get("/public/invitations/:slug/wishes", pubH.Wishes)
	v1.Post("/public/invitations/:slug/wishes", pubH.PostWish)
	v1.Post("/public/invitations/:slug/rsvp", pubH.RSVP)

	secured := v1.Group("", middleware.RequireAuth(cfg.JWTSecret))
	secured.Get("/me", authH.Me)
	secured.Post("/assets/header-image", assetsH.UploadHeaderImage)
	secured.Post("/assets/background-image", assetsH.UploadBackgroundImage)
	secured.Post("/invitations", invH.Create)
	secured.Get("/invitations", invH.List)
	secured.Get("/invitations/:id/guests", guestH.List)
	secured.Post("/invitations/:id/guests", guestH.Create)
	secured.Get("/invitations/:id/rsvp", guestH.ListRSVP)
	secured.Get("/invitations/:id/wishes", guestH.ListWishes)
	secured.Get("/invitations/:id/preview", invH.Preview)
	secured.Get("/invitations/:id", invH.Get)
	secured.Patch("/invitations/:id", invH.Patch)
	secured.Delete("/invitations/:id", invH.Delete)
	secured.Put("/invitations/:id/slides", invH.ReplaceSlides)
}
