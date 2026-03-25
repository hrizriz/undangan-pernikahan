package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"undangan_pernikahan/internal/auth"
)

// LocalsUserID kunci context Fiber untuk UUID user yang login.
const LocalsUserID = "user_id"

// RequireAuth memvalidasi header Authorization: Bearer <JWT>.
func RequireAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		h := c.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
		}
		raw := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
		if raw == "" {
			return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
		}
		uid, err := auth.ParseUserID(raw, secret)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid_or_expired_token"})
		}
		c.Locals(LocalsUserID, uid)
		return c.Next()
	}
}

// UserID membaca user id dari Locals setelah RequireAuth.
func UserID(c *fiber.Ctx) (uuid.UUID, bool) {
	v := c.Locals(LocalsUserID)
	id, ok := v.(uuid.UUID)
	return id, ok
}
