package handler

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"undangan_pernikahan/internal/auth"
	"undangan_pernikahan/internal/config"
	"undangan_pernikahan/internal/mail"
	"undangan_pernikahan/internal/middleware"
	"undangan_pernikahan/internal/repository"
)

const minPasswordLen = 8

type Auth struct {
	users *repository.User
	cfg   config.Config
}

func NewAuth(users *repository.User, cfg config.Config) *Auth {
	return &Auth{users: users, cfg: cfg}
}

type authRegisterBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
}

type verifyEmailBody struct {
	Token string `json:"token"`
}

// Register POST /api/v1/auth/register — tidak mengembalikan JWT sampai email dikonfirmasi.
func (h *Auth) Register(c *fiber.Ctx) error {
	var body authRegisterBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	body.Email = strings.TrimSpace(body.Email)
	if body.Email == "" || !strings.Contains(body.Email, "@") {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_email"})
	}
	if len(body.Password) < minPasswordLen {
		return c.Status(400).JSON(fiber.Map{"error": "password_too_short", "min": minPasswordLen})
	}
	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "hash_failed"})
	}
	vTok, err := auth.GenerateVerifyToken()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "token_failed"})
	}
	expires := time.Now().Add(24 * time.Hour)
	_, err = h.users.CreatePendingRegistration(c.Context(), body.Email, hash, vTok, expires)
	if errors.Is(err, repository.ErrEmailTaken) {
		return c.Status(409).JSON(fiber.Map{"error": "email_taken"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "register_failed"})
	}
	if err := mail.SendVerification(h.cfg, body.Email, vTok); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "mail_failed"})
	}
	return c.Status(201).JSON(fiber.Map{
		"message":            "pending_verification",
		"email":              body.Email,
		"verification_sent": true,
	})
}

// VerifyEmail POST /api/v1/auth/verify-email — mengembalikan JWT setelah sukses.
func (h *Auth) VerifyEmail(c *fiber.Ctx) error {
	var body verifyEmailBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	if strings.TrimSpace(body.Token) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "token_required"})
	}
	id, err := h.users.VerifyEmail(c.Context(), body.Token)
	if errors.Is(err, repository.ErrInvalidVerifyToken) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_or_expired_token"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "verify_failed"})
	}
	token, err := auth.SignAccessToken(id, h.cfg.JWTSecret)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "token_failed"})
	}
	return c.JSON(authTokenResponse{AccessToken: token, TokenType: "Bearer"})
}

// Login POST /api/v1/auth/login
func (h *Auth) Login(c *fiber.Ctx) error {
	var body authRegisterBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	body.Email = strings.TrimSpace(body.Email)
	if body.Email == "" || len(body.Password) < 1 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_credentials"})
	}
	u, err := h.users.GetByEmail(c.Context(), body.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "login_failed"})
	}
	if u == nil || !auth.CheckPassword(u.PasswordHash, body.Password) {
		return c.Status(401).JSON(fiber.Map{"error": "invalid_credentials"})
	}
	if u.EmailVerifiedAt == nil {
		return c.Status(403).JSON(fiber.Map{"error": "email_not_verified"})
	}
	tok, err := auth.SignAccessToken(u.ID, h.cfg.JWTSecret)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "token_failed"})
	}
	return c.JSON(authTokenResponse{AccessToken: tok, TokenType: "Bearer"})
}

// Me GET /api/v1/me
func (h *Auth) Me(c *fiber.Ctx) error {
	uid, ok := middleware.UserID(c)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	u, err := h.users.GetByID(c.Context(), uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if u == nil {
		return c.Status(404).JSON(fiber.Map{"error": "user_not_found"})
	}
	return c.JSON(u)
}

// MustUserID helper untuk handler terproteksi.
func MustUserID(c *fiber.Ctx) (uuid.UUID, error) {
	id, ok := middleware.UserID(c)
	if !ok {
		return uuid.Nil, fiber.ErrUnauthorized
	}
	return id, nil
}
